import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createMockExternalActionAdapter } from "../src/lib/agents/external-action-adapter"
import {
  executeAgentTask,
  resolveAgentApproval,
  startAgentTask,
  AGENT_MEMORY_TABLE,
  AGENT_TASK_EVENT_TABLE,
  AGENT_TASK_TABLE,
  type AgentTaskClient,
  type OpsAssistantContext,
  type OpsAssistantDeps,
} from "../src/lib/agents/ops-assistant"
import {
  AGENT_IDENTITY_TABLE,
  OPS_ASSISTANT_IDENTITY,
  resolveAgentIdentity,
} from "../src/lib/agents/agent-identity"
import {
  AGENT_TASK_WRITE_ROLES,
  LEAD_APPROVAL_APPROVER_ROLES,
  canResolveAgentApproval,
  canStartAgentTask,
} from "../src/lib/agents/authz"
import {
  LEAD_APPROVAL_APPROVER_ROLES as CORE_APPROVER_ROLES,
} from "../src/lib/automation/lead-approval-core"

// ─── In-memory fake Supabase client ──────────────────────────────────────────
// Same builder surface as the orchestrator suite, plus targeted failure
// injection for the ai_agents registry reads/writes. No database, no network.

type Row = Record<string, any>

type FakeOptions = {
  failIdentitySelect?: boolean
  failIdentityInsert?: boolean
}

function createFakeClient(options: FakeOptions = {}) {
  const tables: Record<string, Row[]> = {
    [AGENT_TASK_TABLE]: [],
    [AGENT_TASK_EVENT_TABLE]: [],
    [AGENT_MEMORY_TABLE]: [],
    [AGENT_IDENTITY_TABLE]: [],
  }

  const from = (table: string) => {
    if (!tables[table]) tables[table] = []
    const filters: { col: string; val: any }[] = []
    let pendingInsert: Row | null = null
    let pendingUpdate: Row | null = null
    let pendingLimit: number | null = null
    const matched = () => tables[table].filter((r) => filters.every((f) => r[f.col] === f.val))
    const flushInsert = (): { error: any } => {
      if (!pendingInsert) return { error: null }
      const row = pendingInsert
      pendingInsert = null
      if (table === AGENT_IDENTITY_TABLE && options.failIdentityInsert) {
        return { error: { message: "permission denied for table ai_agents" } }
      }
      if (table === AGENT_TASK_TABLE && row.idempotency_key) {
        const dup = tables[table].find(
          (r) => r.organization_id === row.organization_id && r.idempotency_key === row.idempotency_key,
        )
        if (dup) return { error: { code: "23505" } }
      }
      tables[table].push({ ...row })
      return { error: null }
    }
    const flushUpdate = () => {
      if (pendingUpdate) {
        matched().forEach((r) => Object.assign(r, pendingUpdate))
        pendingUpdate = null
      }
    }
    const chain: any = {
      select: () => chain,
      eq(col: string, val: any) {
        filters.push({ col, val })
        return chain
      },
      order() {
        // No-op: array insertion order already equals creation order here.
        return chain
      },
      limit(n: number) {
        pendingLimit = n
        return chain
      },
      insert(row: Row) {
        pendingInsert = { ...row }
        return chain
      },
      update(patch: Row) {
        pendingUpdate = { ...patch }
        return chain
      },
      async maybeSingle() {
        if (table === AGENT_IDENTITY_TABLE && options.failIdentitySelect) {
          return { data: null, error: { message: 'relation "ai_agents" does not exist' } }
        }
        let rows = matched()
        if (pendingLimit !== null) rows = rows.slice(0, pendingLimit)
        pendingLimit = null
        // Mirror the installed supabase client: maybeSingle slices the array
        // client-side and raises PGRST116 when more than one row matches.
        if (rows.length > 1) {
          return {
            data: null,
            error: {
              code: "PGRST116",
              message: "JSON object requested, multiple (or no) rows returned",
            },
          }
        }
        const ins = flushInsert()
        if (ins.error) return { data: null, error: ins.error }
        flushUpdate()
        return { data: rows.length ? rows[0] : null, error: null }
      },
      then(onFulfilled: any) {
        return Promise.resolve()
          .then(() => {
            const ins = flushInsert()
            flushUpdate()
            return ins
          })
          .then(onFulfilled)
      },
    }
    return chain
  }

  return { tables, from }
}

// ─── Harness ─────────────────────────────────────────────────────────────────

const ORG = "11111111-1111-4111-8111-111111111111"
const ORG_B = "99999999-9999-4999-8999-999999999999"
const CTX: OpsAssistantContext = { organizationId: ORG, agentId: "ops-assistant", createdByUserId: "user-1" }
const NOW = () => new Date("2026-10-19T00:00:00.000Z")

type LogEntry = { level: string; scope: string; message: string }

function makeDeps(
  fakeOptions: FakeOptions = {},
  overrides: Partial<OpsAssistantDeps> = {},
): { deps: OpsAssistantDeps; fake: ReturnType<typeof createFakeClient>; logs: LogEntry[] } {
  const fake = createFakeClient(fakeOptions)
  const logs: LogEntry[] = []
  let seq = 0
  const deps: OpsAssistantDeps = {
    supabase: fake as unknown as AgentTaskClient,
    // Uuid-shaped, deterministic ids: the same generator serves identity rows
    // and task rows, mirroring production where newId() is randomUUID().
    newId: () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
    now: NOW,
    log: (level, scope, message) => {
      logs.push({ level, scope, message })
    },
    ...overrides,
  }
  return { deps, fake, logs }
}

// ─── Identity registry ───────────────────────────────────────────────────────

test("the registry resolves only declared logical ids", () => {
  assert.equal(resolveAgentIdentity("ops-assistant"), OPS_ASSISTANT_IDENTITY)
  assert.equal(resolveAgentIdentity("ghost"), null)
  assert.equal(OPS_ASSISTANT_IDENTITY.roleKind, "ai-worker")
  assert.equal(OPS_ASSISTANT_IDENTITY.reportsTo, "ai-manager")
})

// ─── Identity provisioning (FK safety) ───────────────────────────────────────

test("first start provisions the org-scoped ai_agents row and a FK-safe task", async () => {
  const { deps, fake } = makeDeps()
  const result = await startAgentTask(
    { title: "Weekly report", objective: "Write a weekly status report" },
    CTX,
    deps,
  )
  assert.equal(result.outcome, "planned")

  const identities = fake.tables[AGENT_IDENTITY_TABLE]
  assert.equal(identities.length, 1)
  const identity = identities[0]
  assert.equal(identity.organization_id, ORG)
  assert.equal(identity.role_kind, "ai-worker")
  assert.equal(identity.display_name, "Operations Assistant")
  assert.equal(identity.department, "operations")
  assert.equal(identity.reports_to, "ai-manager")
  assert.equal(identity.status, "active")
  assert.equal(identity.model_ref, null)
  assert.equal(identity.created_by, "user-1")
  assert.ok(identity.capabilities.includes("reporting"))
  assert.ok(identity.tools.includes("external.message.send"))

  // The uuid FK column must carry the registry row id, never the logical id.
  const task = fake.tables[AGENT_TASK_TABLE][0]
  assert.equal(task.agent_id, identity.id)
  assert.notEqual(task.agent_id, "ops-assistant")
})

test("subsequent starts reuse the identity row (no duplicate registry entries)", async () => {
  const { deps, fake } = makeDeps()
  await startAgentTask({ title: "R1", objective: "Write a weekly status report" }, CTX, deps)
  await startAgentTask({ title: "R2", objective: "Summarise the pipeline data" }, CTX, deps)
  assert.equal(fake.tables[AGENT_IDENTITY_TABLE].length, 1)
  const [first, second] = fake.tables[AGENT_TASK_TABLE]
  assert.equal(first.agent_id, second.agent_id)
  assert.equal(first.agent_id, fake.tables[AGENT_IDENTITY_TABLE][0].id)
})

test("identities are organization-scoped (one registry row per org)", async () => {
  const { deps, fake } = makeDeps()
  await startAgentTask({ title: "R1", objective: "Write a weekly status report" }, CTX, deps)
  await startAgentTask(
    { title: "R2", objective: "Write a weekly status report" },
    { ...CTX, organizationId: ORG_B },
    deps,
  )
  const identities = fake.tables[AGENT_IDENTITY_TABLE]
  assert.equal(identities.length, 2)
  assert.deepEqual(identities.map((i) => i.organization_id).sort(), [ORG, ORG_B].sort())
  const tasks = fake.tables[AGENT_TASK_TABLE]
  assert.notEqual(tasks[0].agent_id, tasks[1].agent_id)
})

test("duplicate identity rows (a concurrent first-start race) converge on the oldest row", async () => {
  const { deps, fake } = makeDeps()
  // Simulate the documented race outcome: two rows already exist for the same
  // org + agent. The installed client's maybeSingle() would raise PGRST116 on
  // both matches; the LIMIT 1 in ensureAgentIdentity must prevent that.
  fake.tables[AGENT_IDENTITY_TABLE].push(
    {
      id: "aaaaaaaa-0000-4000-8000-000000000001",
      organization_id: ORG,
      role_kind: "ai-worker",
      display_name: "Operations Assistant",
      created_at: "2026-10-19T00:00:00.000Z",
    },
    {
      id: "aaaaaaaa-0000-4000-8000-000000000002",
      organization_id: ORG,
      role_kind: "ai-worker",
      display_name: "Operations Assistant",
      created_at: "2026-10-20T00:00:00.000Z",
    },
  )
  const result = await startAgentTask(
    { title: "T", objective: "Write a weekly status report" },
    CTX,
    deps,
  )
  assert.equal(result.outcome, "planned")
  // No third row is created; every reference converges on the oldest row.
  assert.equal(fake.tables[AGENT_IDENTITY_TABLE].length, 2)
  assert.equal(fake.tables[AGENT_TASK_TABLE][0].agent_id, "aaaaaaaa-0000-4000-8000-000000000001")
})

test("an unknown logical agent id fails before any row is written", async () => {
  const { deps, fake } = makeDeps()
  await assert.rejects(
    startAgentTask(
      { title: "T", objective: "Write a weekly status report" },
      { ...CTX, agentId: "ghost" },
      deps,
    ),
    /Unknown agent identity "ghost"/,
  )
  assert.equal(fake.tables[AGENT_IDENTITY_TABLE].length, 0)
  assert.equal(fake.tables[AGENT_TASK_TABLE].length, 0)
})

test("an unreadable agent registry fails honestly with no task row", async () => {
  const { deps, fake, logs } = makeDeps({ failIdentitySelect: true })
  await assert.rejects(
    startAgentTask({ title: "T", objective: "Write a weekly status report" }, CTX, deps),
    /Agent identity is unavailable/,
  )
  assert.equal(fake.tables[AGENT_TASK_TABLE].length, 0)
  assert.ok(logs.some((l) => l.scope === "agent.identity.resolve"))
})

test("a rejected identity insert fails honestly with no task row", async () => {
  const { deps, fake, logs } = makeDeps({ failIdentityInsert: true })
  await assert.rejects(
    startAgentTask({ title: "T", objective: "Write a weekly status report" }, CTX, deps),
    /Agent identity could not be provisioned/,
  )
  assert.equal(fake.tables[AGENT_IDENTITY_TABLE].length, 0)
  assert.equal(fake.tables[AGENT_TASK_TABLE].length, 0)
  assert.ok(logs.some((l) => l.scope === "agent.identity.create"))
})

// ─── Memory FK safety ────────────────────────────────────────────────────────

test("task memory is written under the identity row id, never the logical id", async () => {
  const { deps, fake } = makeDeps()
  const started = await startAgentTask(
    { title: "R", objective: "Write a weekly status report" },
    CTX,
    deps,
  )
  assert.equal(started.outcome, "planned")
  if (started.outcome !== "planned") return

  const executed = await executeAgentTask(started.taskId, CTX, deps, {
    knowledge: ["Pipeline healthy"],
  })
  assert.equal(executed.outcome, "succeeded")

  const identityId = fake.tables[AGENT_IDENTITY_TABLE][0].id
  const memory = fake.tables[AGENT_MEMORY_TABLE]
  assert.ok(memory.length > 0)
  for (const row of memory) {
    assert.equal(row.agent_id, identityId)
    assert.notEqual(row.agent_id, "ops-assistant")
  }
})

test("approved outreach flow keeps the identity FK through memory", async () => {
  const external = createMockExternalActionAdapter()
  const { deps, fake } = makeDeps({}, { external })
  const started = await startAgentTask(
    { title: "Reply", objective: "Send a follow-up email to the inbound lead" },
    CTX,
    deps,
  )
  assert.equal(started.outcome, "awaiting_approval")
  if (started.outcome !== "awaiting_approval") return

  const approved = await resolveAgentApproval(started.taskId, "approved", CTX, deps)
  assert.equal(approved.outcome, "succeeded")
  assert.equal(external.performed.length, 1)

  const identityId = fake.tables[AGENT_IDENTITY_TABLE][0].id
  const memory = fake.tables[AGENT_MEMORY_TABLE]
  assert.ok(memory.length > 0)
  for (const row of memory) {
    assert.equal(row.agent_id, identityId)
    assert.notEqual(row.agent_id, "ops-assistant")
  }
})

// ─── Authorization boundaries ────────────────────────────────────────────────

test("agent task authorization boundaries are pure and explicit", () => {
  assert.equal(canStartAgentTask("owner"), true)
  assert.equal(canStartAgentTask("admin"), true)
  assert.equal(canStartAgentTask("member"), true)
  assert.equal(canStartAgentTask("viewer"), false)
  assert.equal(canStartAgentTask(null), false)
  assert.equal(canStartAgentTask(undefined), false)
  assert.equal(canStartAgentTask("root"), false)

  assert.equal(canResolveAgentApproval("owner"), true)
  assert.equal(canResolveAgentApproval("admin"), true)
  assert.equal(canResolveAgentApproval("member"), false)
  assert.equal(canResolveAgentApproval("viewer"), false)
  assert.equal(canResolveAgentApproval(null), false)

  assert.deepEqual([...AGENT_TASK_WRITE_ROLES], ["owner", "admin", "member"])
  // The agent approval boundary reuses the lead-approval definition verbatim.
  assert.deepEqual([...LEAD_APPROVAL_APPROVER_ROLES], [...CORE_APPROVER_ROLES])
})

test("service wiring sources role gates from the pure authz module", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/agents/ops-assistant-service.ts"), "utf8")
  assert.ok(src.includes('from "@/lib/agents/authz"'))
  assert.ok(src.includes("AGENT_TASK_WRITE_ROLES"))
  assert.ok(src.includes("LEAD_APPROVAL_APPROVER_ROLES"))
  assert.ok(src.includes("assertRole"))
  assert.ok(src.startsWith('import "server-only"'))
  assert.ok(src.includes("organization_memberships"))

  const orchestrator = readFileSync(join(process.cwd(), "src/lib/agents/ops-assistant.ts"), "utf8")
  assert.ok(orchestrator.includes("ensureAgentIdentity"))
  assert.ok(orchestrator.includes("task.agentId"))
})
