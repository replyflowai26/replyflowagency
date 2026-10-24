/**
 * Jarvis CEO report + notification contract (task 62).
 *
 * The report is only trustworthy if it never converts "I could not read this"
 * into zero, and if its recommendation follows a deterministic priority. These
 * tests pin both properties, plus the mandatory notification safeguards.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  buildCeoReport,
  CEO_REPORT_APPROVER_ROLE,
  CEO_REPORT_WINDOW_DAYS,
  type CeoReportInput,
} from "../src/lib/agents/ceo-report"
import {
  NOTIFICATION_DAILY_SEND_LIMIT,
  NOTIFICATION_REQUIRED_GUARANTEES,
  describeNotificationProviders,
  validateNotificationRequest,
  type NotificationDeliveryRequest,
} from "../src/lib/agents/notification-providers"
import * as notificationProviders from "../src/lib/agents/notification-providers"

const EMPTY_COUNTS = {
  created: 0,
  queued: 0,
  running: 0,
  succeeded: 0,
  failed: 0,
  cancelled: 0,
  blockedOnApproval: 0,
}

const EMPTY_PIPELINE = {
  lead: 0,
  prospect: 0,
  active: 0,
  paused: 0,
  completed: 0,
  archived: 0,
}

function baseInput(overrides: Partial<CeoReportInput> = {}): CeoReportInput {
  return {
    generatedAt: "2026-10-22T10:00:00.000Z",
    tasks: { status: "available", data: { counts: { ...EMPTY_COUNTS } } },
    pendingApprovals: { status: "available", data: { total: 0, items: [] } },
    recentOutcomes: { status: "available", data: { items: [], failedInWindow: 0 } },
    pipeline: { status: "available", data: { counts: { ...EMPTY_PIPELINE } } },
    ...overrides,
  }
}

test("available empty data yields real zeros and a create-task recommendation", () => {
  const report = buildCeoReport(baseInput())
  assert.equal(report.tasks.status, "available")
  assert.equal(report.tasks.status === "available" && report.tasks.data.counts.created, 0)
  assert.equal(report.nextAction.kind, "create-task")
  assert.equal(report.windowDays, CEO_REPORT_WINDOW_DAYS)
  // Only the two not-configured gaps: AI cost and notification delivery.
  assert.deepEqual(
    report.dataGaps.map((gap) => gap.id),
    ["ai-costs", "notifications"],
  )
})

test("an unreadable task source is unknown, never zero", () => {
  const report = buildCeoReport(
    baseInput({
      tasks: {
        status: "unavailable",
        reason: "Agent task tables are not provisioned (B1 → B2).",
      },
    }),
  )
  assert.equal(report.tasks.status, "unavailable")
  assert.equal(report.tasks.status === "unavailable" && report.tasks.reason.includes("B1"), true)
  const gap = report.dataGaps.find((entry) => entry.id === "tasks")
  assert.ok(gap)
  assert.equal(gap.kind, "unavailable")
  assert.notEqual(report.nextAction.kind, "create-task")
})

test("when every core source is unavailable the first action is restoring data", () => {
  const report = buildCeoReport(
    baseInput({
      tasks: { status: "unavailable", reason: "tasks missing" },
      pendingApprovals: { status: "unavailable", reason: "approvals missing" },
      recentOutcomes: { status: "unavailable", reason: "runs missing" },
    }),
  )
  assert.equal(report.nextAction.kind, "restore-data")
  const ids = report.dataGaps.map((gap) => gap.id)
  assert.ok(ids.includes("tasks") && ids.includes("approvals") && ids.includes("runs"))
})

test("pending approvals count, carry the responsible role, and outrank failures", () => {
  const report = buildCeoReport(
    baseInput({
      pendingApprovals: {
        status: "available",
        data: {
          total: 3,
          items: [
            {
              id: "t1",
              kind: "agent-task",
              title: "Prepare the weekly report",
              createdAt: "2026-10-22T09:00:00.000Z",
            },
            {
              id: "r1",
              kind: "workflow-run",
              title: "Lead capture — lead approval",
              createdAt: "2026-10-22T08:00:00.000Z",
            },
          ],
        },
      },
      recentOutcomes: {
        status: "available",
        data: {
          items: [
            {
              id: "run-1",
              workflowName: "Lead capture",
              status: "failed",
              errorCode: "CRM_TIMEOUT",
              errorMessage: "The CRM endpoint timed out.",
              createdAt: "2026-10-22T07:00:00.000Z",
            },
          ],
          failedInWindow: 2,
        },
      },
    }),
  )
  assert.equal(report.pendingApprovals.status, "available")
  if (report.pendingApprovals.status !== "available") return
  assert.equal(report.pendingApprovals.data.total, 3)
  // Only the readable items are listed; the total still reflects the count query.
  assert.equal(report.pendingApprovals.data.items.length, 2)
  for (const item of report.pendingApprovals.data.items) {
    assert.equal(item.approverRole, CEO_REPORT_APPROVER_ROLE)
  }
  assert.equal(report.nextAction.kind, "resolve-approvals")
  assert.match(report.nextAction.label, /3 pending approvals/)
})

test("failed runs outrank an empty task list and keep the recorded error", () => {
  const report = buildCeoReport(
    baseInput({
      tasks: { status: "available", data: { counts: { ...EMPTY_COUNTS, created: 4, failed: 1 } } },
      recentOutcomes: {
        status: "available",
        data: {
          items: [
            {
              id: "run-9",
              workflowName: "Inbound lead capture",
              status: "failed",
              errorCode: "CRM_UNAVAILABLE",
              errorMessage: "No external adapter is configured.",
              createdAt: "2026-10-22T06:00:00.000Z",
            },
          ],
          failedInWindow: 1,
        },
      },
    }),
  )
  assert.equal(report.recentOutcomes.status, "available")
  if (report.recentOutcomes.status !== "available") return
  assert.equal(report.recentOutcomes.data.items[0].errorCode, "CRM_UNAVAILABLE")
  assert.equal(report.nextAction.kind, "review-failures")
  assert.match(report.nextAction.label, /1 failed run/)
})

test("queued work is recommended only when no approval or failure needs attention", () => {
  const report = buildCeoReport(
    baseInput({
      tasks: {
        status: "available",
        data: { counts: { ...EMPTY_COUNTS, created: 2, queued: 2, blockedOnApproval: 1 } },
      },
    }),
  )
  assert.equal(report.tasks.status === "available" && report.tasks.data.counts.blockedOnApproval, 1)
  assert.equal(report.nextAction.kind, "run-task")
  assert.match(report.nextAction.label, /2 queued tasks/)
})

test("counts are sanitised: negative or non-finite values never become activity", () => {
  const report = buildCeoReport(
    baseInput({
      tasks: {
        status: "available",
        data: {
          counts: {
            created: -5,
            queued: Number.NaN,
            running: 1.9,
            succeeded: Number.POSITIVE_INFINITY,
            failed: -1,
            cancelled: 0,
            blockedOnApproval: Number.NEGATIVE_INFINITY,
          },
        },
      },
      pipeline: {
        status: "available",
        data: { counts: { ...EMPTY_PIPELINE, lead: -3, active: 2.8 } },
      },
    }),
  )
  assert.equal(report.tasks.status, "available")
  if (report.tasks.status !== "available") return
  assert.deepEqual(report.tasks.data.counts, {
    created: 0,
    queued: 0,
    running: 1,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    blockedOnApproval: 0,
  })
  if (report.pipeline.status === "available") {
    assert.equal(report.pipeline.data.counts.lead, 0)
    assert.equal(report.pipeline.data.counts.active, 2)
    assert.equal(report.pipeline.data.total, 2)
  }
})

test("client pipeline counts are real rows and an unreadable pipeline is unknown", () => {
  const available = buildCeoReport(
    baseInput({
      pipeline: {
        status: "available",
        data: { counts: { ...EMPTY_PIPELINE, lead: 4, prospect: 2, active: 1 } },
      },
    }),
  )
  assert.equal(available.pipeline.status, "available")
  if (available.pipeline.status !== "available") return
  assert.equal(available.pipeline.data.total, 7)

  const unavailable = buildCeoReport(
    baseInput({ pipeline: { status: "unavailable", reason: "clients unreadable" } }),
  )
  assert.equal(unavailable.pipeline.status, "unavailable")
  assert.ok(unavailable.dataGaps.some((gap) => gap.id === "pipeline"))
})

test("AI cost is always not-configured and no notification channel claims readiness", () => {
  const report = buildCeoReport(baseInput())
  assert.equal(report.aiCosts.status, "not-configured")
  assert.match(report.aiCosts.detail, /unknown/i)
  assert.equal(report.notifications.length, 3)
  for (const channel of report.notifications) {
    assert.equal(channel.status, "not-built")
  }
})

const VALID_REQUEST: NotificationDeliveryRequest = {
  organizationId: "org-1",
  channel: "email",
  kind: "internal-report",
  recipient: {
    address: "ceo@example.com",
    optedInAt: "2026-10-01T00:00:00.000Z",
    optedOutAt: null,
  },
  templateId: "weekly-ceo-report",
  idempotencyKey: "weekly-ceo-report-2026-10-22",
  requiresApproval: false,
  dailySendCount: 0,
  estimatedCostUsd: 0.01,
  dailyCostBudgetUsd: 1,
}

function errorsOf(request: NotificationDeliveryRequest): readonly string[] {
  const result = validateNotificationRequest(request)
  return result.ok ? [] : result.errors
}

test("a compliant request passes validation, but still cannot be sent from this module", () => {
  assert.deepEqual(errorsOf(VALID_REQUEST), [])
  // A valid WhatsApp outreach request with approval + consent also passes.
  assert.deepEqual(
    errorsOf({
      ...VALID_REQUEST,
      channel: "whatsapp",
      kind: "outreach",
      requiresApproval: true,
      recipient: {
        address: "+14155550123",
        optedInAt: "2026-10-01T00:00:00.000Z",
        optedOutAt: null,
      },
    }),
    [],
  )
  const moduleExports = notificationProviders as unknown as Record<string, unknown>
  assert.equal("sendNotification" in moduleExports, false)
  assert.equal("send" in moduleExports, false)
})

test("outreach without approval, missing consent, opt-out and bad recipients are rejected", () => {
  assert.match(
    errorsOf({ ...VALID_REQUEST, kind: "outreach", requiresApproval: false }).join(" "),
    /explicit human approval/,
  )
  assert.match(
    errorsOf({
      ...VALID_REQUEST,
      recipient: { ...VALID_REQUEST.recipient, optedInAt: null },
    }).join(" "),
    /not opted in/,
  )
  assert.match(
    errorsOf({
      ...VALID_REQUEST,
      recipient: { ...VALID_REQUEST.recipient, optedOutAt: "2026-10-20T00:00:00.000Z" },
    }).join(" "),
    /opted out/,
  )
  assert.match(
    errorsOf({ ...VALID_REQUEST, recipient: { ...VALID_REQUEST.recipient, address: "not-an-email" } }).join(" "),
    /valid email/,
  )
  assert.match(
    errorsOf({
      ...VALID_REQUEST,
      channel: "phone",
      recipient: { ...VALID_REQUEST.recipient, address: "415-555-0123" },
    }).join(" "),
    /E\.164/,
  )
  assert.match(errorsOf({ ...VALID_REQUEST, organizationId: " " }).join(" "), /tenant/)
})

test("idempotency, daily limits and cost budgets are enforced before any send", () => {
  assert.match(errorsOf({ ...VALID_REQUEST, idempotencyKey: "short" }).join(" "), /Idempotency key/)
  assert.match(
    errorsOf({ ...VALID_REQUEST, dailySendCount: NOTIFICATION_DAILY_SEND_LIMIT }).join(" "),
    /Daily send limit/,
  )
  assert.match(
    errorsOf({ ...VALID_REQUEST, estimatedCostUsd: 5, dailyCostBudgetUsd: 1 }).join(" "),
    /exceeds the daily budget/,
  )
  assert.equal(
    NOTIFICATION_REQUIRED_GUARANTEES.some((guarantee) => /idempotency/i.test(guarantee)),
    true,
  )
})

test("every notification channel is reported as not built", () => {
  const providers = describeNotificationProviders()
  assert.deepEqual(
    providers.map((provider) => provider.channel),
    ["email", "whatsapp", "phone"],
  )
  for (const provider of providers) {
    assert.equal(provider.status, "not-built")
    assert.match(provider.detail, /No provider is configured/)
  }
})

test("the dashboard wires the report read-only and keeps tenant scoping server-side", () => {
  const page = readFileSync(
    join(process.cwd(), "src/app/dashboard/jarvis/page.tsx"),
    "utf8",
  )
  assert.match(page, /CeoReportPanel/)
  assert.match(page, /getCeoReport\(membership\.organization_id\)/)

  const service = readFileSync(
    join(process.cwd(), "src/lib/agents/ceo-report-service.ts"),
    "utf8",
  )
  assert.match(service, /^import "server-only"/m)
  assert.match(service, /eq\("organization_id", organizationId\)/)
  assert.equal(/\.(insert|update|delete|upsert|rpc)\(/.test(service), false)

  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    scripts: Record<string, string>
  }
  assert.match(pkg.scripts["test:bridge"], /tests\/ceo-report\.test\.js/)
})
