import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

//
// The local E2E callback test creates its own workflow_runs row, which needs a
// workflow_runs -> workflows FK target. Its fixture used to claim
// `workflows.n8n_workflow_id` for the n8n workflow it drives, which is a
// *globally* unique one-to-one mapping. Because the n8n workflow is a real,
// shared local workflow that can already be mapped to an unrelated
// pre-existing workflow row, that claim fails with unique-violation 23505 and
// aborts the whole run before the callback is ever exercised.
//
// The fixture now leaves that column NULL (legal, because the index is partial)
// and triggers n8n directly by webhook path. These tests lock in that decision
// so the conflict cannot silently return, and so cleanup can never start
// deleting pre-existing rows.
//

function readSource(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8")
}

const e2eSrc = readSource("tests/local-e2e-callback.test.ts")
const mappingMigration = readSource(
  "supabase/migrations/20260816000004_n8n_workflow_mapping.sql",
)

/**
 * Return `{ body, end }` for the object literal whose `{` sits at `openBrace`.
 *
 * A plain `indexOf("})")` is not safe here: the insert payload carries a long
 * explanatory comment, and any `})` appearing inside that prose would truncate
 * the slice early. Brace counting is used instead, skipping line comments and
 * quoted strings so their braces never affect the depth.
 */
function extractObjectLiteral(src: string, openBrace: number): { body: string; end: number } {
  assert.equal(src[openBrace], "{", "expected an object literal at the insert payload")
  let depth = 0
  for (let i = openBrace; i < src.length; i++) {
    const ch = src[i]
    if (ch === "\n") continue
    // Line comments: skip to end of line (no brace significance).
    if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++
      continue
    }
    // Quoted strings: skip to the closing quote (no brace significance).
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch
      i++
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i++
        else if (src[i] === "\n" && quote !== "`") break
        i++
      }
      continue
    }
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth === 0) return { body: src.slice(openBrace, i + 1), end: i }
    }
  }
  throw new Error("unterminated insert object literal")
}

/**
 * The `.insert({...})` object literal used for the fixture workflow row.
 *
 * Anchored deliberately. `.from("workflows")` occurs twice in the E2E source:
 * once in `runCleanup()` (a DELETE) and once on the insert. `runCleanup()` is
 * declared first, so anchoring on the bare table name resolves to the cleanup
 * delete and then walks forward to an unrelated insert payload — the
 * organizations insert — silently yielding a body that contains none of the
 * workflow columns. Require `.from("workflows")` to be chained straight into
 * `.insert(` and assert that exactly one such call site exists.
 */
function workflowInsertBody(src: string): string {
  const callSites = [...src.matchAll(/\.from\(["']workflows["']\)(?:\s|\/\/[^\n]*\n)*\.insert\(/g)]
  assert.equal(
    callSites.length,
    1,
    "expected exactly one workflows insert call site (must not match the cleanup delete)",
  )
  const openBrace = callSites[0].index! + callSites[0][0].length
  const { body } = extractObjectLiteral(src, openBrace)
  // Guard against silently re-extracting a neighbouring payload: the workflow
  // insert is the only one carrying both FK columns.
  assert.match(body, /organization_id:\s*orgId/)
  assert.match(body, /project_id:\s*projectId/)
  return body
}

// ─── The strategy depends on the index being partial ──────────────────────────

test("workflows.n8n_workflow_id unique index is partial, so NULL fixtures may coexist", () => {
  assert.match(mappingMigration, /create unique index if not exists workflows_n8n_workflow_id_idx/)
  // The trailing predicate is the entire basis for the NULL strategy: without
  // it, a NULL column would still be indexed and one fixture would be legal but
  // the intent would be accidental.
  assert.match(
    mappingMigration,
    /create unique index if not exists workflows_n8n_workflow_id_idx[\s\S]*?where n8n_workflow_id is not null/,
  )
  // The column must remain nullable, or a NULL fixture insert would fail.
  assert.match(mappingMigration, /add column if not exists n8n_workflow_id text(?!.*not null)/)
})

// ─── The fixture must never claim the globally unique mapping ─────────────────

test("E2E fixture workflow row does not claim a real n8n_workflow_id", () => {
  const body = workflowInsertBody(e2eSrc)
  assert.match(body, /n8n_workflow_id:\s*null/)
  assert.doesNotMatch(
    body,
    /n8n_workflow_id:\s*["'`]ODCxASjOnuMk8fyW["'`]/,
    "fixture must not hardcode a real n8n workflow id into the unique column",
  )
})

test("the n8n workflow id is used only to reach n8n, never written to the mapping", () => {
  // Reached via the fetch/lookup and the dispatch trigger only.
  assert.match(e2eSrc, /api\/v1\/workflows\/\$\{N8N_WORKFLOW_ID\}/)
  // Kept in one named constant so it is never re-hardcoded at a second site.
  assert.equal(
    e2eSrc.match(/ODCxASjOnuMk8fyW/g)?.length,
    1,
    "the raw n8n workflow id should appear exactly once, as the constant",
  )
})

test("E2E fixture keeps the webhook path so the run stays traceable", () => {
  const body = workflowInsertBody(e2eSrc)
  assert.match(body, /n8n_webhook_path:\s*webhookPath/)
  // The webhook path index is deliberately non-unique, so this cannot collide.
  assert.match(mappingMigration, /create index if not exists workflows_n8n_webhook_path_idx/)
})

// ─── Cleanup must run on failure and never touch pre-existing rows ───────────

test("E2E cleanup runs in a finally block so it survives thrown failures", () => {
  assert.match(e2eSrc, /finally\s*\{\s*await runCleanup\(\)/)
  // The gate must run before the try, so a blocked target creates nothing.
  assert.match(e2eSrc, /assertSafeTestTarget\(\)\s*\n\s*try\s*\{/)
})

test("E2E cleanup deletes only the ids this run created", () => {
  // Every destructive statement is scoped to a captured fixture id.
  for (const scoped of [
    /from\("workflow_run_events"\)\.delete\(\)\.eq\("run_id", runId\)/,
    /from\("workflow_runs"\)\.delete\(\)\.eq\("id", runId\)/,
    /from\("workflows"\)\.delete\(\)\.eq\("id", workflowId\)/,
    /from\("automation_projects"\)\.delete\(\)\.eq\("id", projectId\)/,
    /from\("organizations"\)\.delete\(\)\.eq\("id", orgId\)/,
  ]) {
    assert.match(e2eSrc, scoped)
  }

  // No blanket or predicate-free destructive statement may appear.
  assert.doesNotMatch(e2eSrc, /\.delete\(\)\s*(;|$|\n)/m)
  // Nothing may be targeted by the n8n workflow id, which belongs to a
  // pre-existing row this test does not own.
  assert.doesNotMatch(e2eSrc, /delete\(\)[^;]*n8n_workflow_id/)
  assert.doesNotMatch(e2eSrc, /\.neq\("n8n_workflow_id"/)
})

// ─── The safety gate must survive fixture changes ────────────────────────────

test("E2E safety gate still refuses any non-local target", () => {
  // The gate reads the env var via .env.e2e.local first, with process.env only
  // as a fallback, and holds it in the E2E_TARGET const.
  assert.match(
    e2eSrc,
    /const E2E_TARGET = env\.REPLYFLOW_E2E_TARGET \?\? process\.env\.REPLYFLOW_E2E_TARGET/,
  )
  // Fail-closed: anything other than exactly "test" is refused, and the refusal
  // exits non-zero inside the guard rather than falling through. Scoped to this
  // one guard so a later process.exit in an unrelated branch cannot satisfy it.
  assert.match(
    e2eSrc,
    /if \(E2E_TARGET !== "test"\) \{[^}]*?console\.error\([^)]*\)[^}]*?process\.exit\(1\)[^}]*?\}/,
  )
  assert.match(e2eSrc, /LOCALHOST_URL_RE\.test\(SUPABASE_URL!\)/)
  assert.match(e2eSrc, /LOCALHOST_URL_RE\.test\(N8N_BASE\)/)
  assert.match(e2eSrc, /E2E_REF !== "localhost" \|\| configuredRef !== "localhost"/)
})