// Local, self-contained demo of the first internal agent (Operations Assistant).
//
// WHAT THIS SHOWS
//   A task travels the REAL orchestration code: validate → deterministic
//   classification/planning (no LLM) → durable queued task (in-memory Supabase
//   substitute) → human approval gate for consequential steps → deterministic
//   tool execution → result + scoped memory. It is the executable definition of
//   the first AI worker.
//
// WHAT THIS DOES NOT DO (deliberately)
//   - No database, no network, no LLM, no n8n, no secrets. The Supabase client
//     is an in-memory fake; the model is deterministic; the external action
//     adapter is an explicit MOCK.
//   - Nothing is persisted and no external system is contacted.
//
// Run with: npm run demo:ops-assistant

import { createRequire } from "node:module"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)))
const dist = (p) => resolve(REPO_ROOT, ".test-dist/src/lib", p)

const assistant = require(dist("agents/ops-assistant.js"))
const external = require(dist("agents/external-action-adapter.js"))

const ORG = "11111111-1111-4111-8111-111111111111"
const CTX = { organizationId: ORG, agentId: "ops-assistant", createdByUserId: "user-owner" }

function createFakeClient() {
  const tables = { ai_agent_tasks: [], ai_agent_task_events: [], ai_agent_memory: [] }
  const from = (table) => {
    if (!tables[table]) tables[table] = []
    const filters = []
    let pendingInsert = null
    let pendingUpdate = null
    const matched = () => tables[table].filter((r) => filters.every((f) => r[f.col] === f.val))
    const flushInsert = () => {
      if (pendingInsert) {
        const row = pendingInsert
        pendingInsert = null
        if (table === "ai_agent_tasks" && row.idempotency_key) {
          const dup = tables[table].find(
            (r) => r.organization_id === row.organization_id && r.idempotency_key === row.idempotency_key,
          )
          if (dup) return { error: { code: "23505" } }
        }
        tables[table].push({ ...row })
      }
      return { error: null }
    }
    const flushUpdate = () => {
      if (pendingUpdate) {
        matched().forEach((r) => Object.assign(r, pendingUpdate))
        pendingUpdate = null
      }
    }
    const chain = {
      select: () => chain,
      eq(col, val) {
        filters.push({ col, val })
        return chain
      },
      // No-ops consumed by ensureAgentIdentity (agent-identity.ts).
      order: () => chain,
      limit: () => chain,
      insert(row) {
        pendingInsert = { ...row }
        return chain
      },
      update(patch) {
        pendingUpdate = { ...patch }
        return chain
      },
      async maybeSingle() {
        const rows = matched()
        const ins = flushInsert()
        if (ins.error) return { data: null, error: ins.error }
        flushUpdate()
        return { data: rows.length ? rows[0] : null, error: null }
      },
      then(onFulfilled) {
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

function line(label, value) {
  console.log(`  ${label.padEnd(24)} ${value}`)
}

function showTask(fake, taskId) {
  const task = fake.tables.ai_agent_tasks.find((t) => t.id === taskId)
  const events = fake.tables.ai_agent_task_events.filter((e) => e.task_id === taskId)
  console.log(`\n  task ${taskId}`)
  line("category", task.category)
  line("status", task.status)
  line("approval_state", task.approval_state)
  line("requires_approval", String(task.requires_approval))
  line("event timeline", events.map((e) => e.event_type.replace("agent.task.", "")).join("  →  "))
  return task
}

async function main() {
  const fake = createFakeClient()
  let seq = 0
  const externalAdapter = external.createMockExternalActionAdapter()
  const deps = {
    supabase: fake,
    external: externalAdapter,
    newId: () => `task-${String(++seq).padStart(3, "0")}`,
    now: () => new Date("2026-10-06T00:00:00.000Z"),
  }

  console.log("\nReplyFlow AI · Operations Assistant (local demo, deterministic, no LLM/DB/network)")
  console.log("=".repeat(88))

  console.log("\n[1] invalid request is rejected before anything is stored")
  const bad = await assistant.startAgentTask({ title: "", objective: "no" }, CTX, deps)
  line("outcome", bad.outcome)
  line("errors", bad.errors.join(" / "))
  line("tasks stored", String(fake.tables.ai_agent_tasks.length))

  console.log("\n[2] research task → deterministic plan, no approval needed, auto-run")
  const research = await assistant.startAgentTask(
    { title: "Competitor scan", objective: "Research competitors in our market", knowledge: ["Competitor X raised a seed round"] },
    CTX,
    deps,
  )
  line("outcome", research.outcome)
  line("plan steps", research.plan.steps.map((s) => s.tool).join(", "))
  const ran = await assistant.executeAgentTask(research.taskId, CTX, deps, { knowledge: ["Competitor X raised a seed round"] })
  line("execute outcome", ran.outcome)
  showTask(fake, research.taskId)

  console.log("\n[3] outreach task → consequential step is GATED behind human approval")
  const outreach = await assistant.startAgentTask(
    { title: "Reply to inbound lead", objective: "Send a follow-up email to the inbound lead" },
    CTX,
    deps,
  )
  line("outcome", outreach.outcome)
  line("plan steps", outreach.plan.steps.map((s) => `${s.tool}${s.consequential ? " (consequential)" : ""}`).join(", "))
  const premature = await assistant.executeAgentTask(outreach.taskId, CTX, deps)
  line("execute before approval", premature.outcome)
  line("external actions so far", String(externalAdapter.performed.length))
  showTask(fake, outreach.taskId)

  console.log("\n[4] owner approves → the consequential action runs exactly once")
  const approved = await assistant.resolveAgentApproval(outreach.taskId, "approved", CTX, deps)
  line("outcome", approved.outcome)
  line("external actions", String(externalAdapter.performed.length))
  showTask(fake, outreach.taskId)

  console.log("\n[5] a second decision on the same task is refused (no double send)")
  const again = await assistant.resolveAgentApproval(outreach.taskId, "approved", CTX, deps)
  line("outcome", again.outcome)

  console.log("\n[6] finance task → rejected by the approver, task cancelled")
  const finance = await assistant.startAgentTask({ title: "Pay vendor", objective: "Create an invoice payment for the vendor" }, CTX, deps)
  line("start outcome", finance.outcome)
  const rejected = await assistant.resolveAgentApproval(finance.taskId, "rejected", CTX, deps)
  line("decision outcome", rejected.outcome)
  showTask(fake, finance.taskId)

  console.log("\n" + "=".repeat(88))
  console.log(
    `tasks: ${fake.tables.ai_agent_tasks.length} · events: ${fake.tables.ai_agent_task_events.length} · memory: ${fake.tables.ai_agent_memory.length} · external actions: ${externalAdapter.performed.length}`,
  )
  console.log("All state lived in-memory. Nothing was persisted and no external system was contacted.\n")
}

main().catch((error) => {
  console.error("Demo failed:", error instanceof Error ? error.message : error)
  process.exitCode = 1
})
