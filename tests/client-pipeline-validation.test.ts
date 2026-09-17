import assert from "node:assert/strict"
import test from "node:test"
import {
  isClientStatus,
  isOutreachStatus,
  parseClientPipelineInput,
} from "../src/lib/leads/client-pipeline.js"

test("isClientStatus returns true for valid statuses", () => {
  assert.equal(isClientStatus("lead"), true)
  assert.equal(isClientStatus("active"), true)
  assert.equal(isClientStatus("archived"), true)
})

test("isClientStatus returns false for invalid statuses", () => {
  assert.equal(isClientStatus(""), false)
  assert.equal(isClientStatus("LEAD"), false)
  assert.equal(isClientStatus("prospect"), true)
})

test("isOutreachStatus returns true for valid statuses", () => {
  assert.equal(isOutreachStatus("not_started"), true)
  assert.equal(isOutreachStatus("following_up"), true)
  assert.equal(isOutreachStatus("meeting_scheduled"), true)
  assert.equal(isOutreachStatus("closed_won"), true)
  assert.equal(isOutreachStatus("closed_lost"), true)
})

test("isOutreachStatus returns false for invalid statuses", () => {
  assert.equal(isOutreachStatus(""), false)
  assert.equal(isOutreachStatus("pending"), false)
  assert.equal(isOutreachStatus("CONTACTED"), false)
})

test("parseClientPipelineInput rejects empty name", () => {
  const result = parseClientPipelineInput({ name: "" })
  assert.ok("error" in result)
  assert.ok(result.error.length > 0)
})

test("parseClientPipelineInput rejects invalid email", () => {
  const result = parseClientPipelineInput({ name: "Test", email: "not-an-email" })
  assert.ok("error" in result)
})

test("parseClientPipelineInput rejects invalid status", () => {
  const result = parseClientPipelineInput({ name: "Test", status: "INVALID" })
  assert.ok("error" in result)
  assert.ok(result.error.includes("status"))
})

test("parseClientPipelineInput rejects invalid outreach status", () => {
  const result = parseClientPipelineInput({ name: "Test", outreachStatus: "invalid_outreach" })
  assert.ok("error" in result)
  assert.ok(result.error.includes("outreach"))
})

test("parseClientPipelineInput rejects invalid next follow-up date", () => {
  const result = parseClientPipelineInput({ name: "Test", nextFollowUpAt: "not-a-date" })
  assert.ok("error" in result)
  assert.ok(result.error.includes("follow-up"))
})

test("parseClientPipelineInput accepts valid minimal input", () => {
  const result = parseClientPipelineInput({ name: "Acme Corp" })
  assert.ok("value" in result)
  assert.equal(result.value.status, "lead")
  assert.equal(result.value.outreach_status, "not_started")
  assert.equal(result.value.next_follow_up_at, null)
})

test("parseClientPipelineInput normalizes date-only follow-up", () => {
  const result = parseClientPipelineInput({ name: "Acme Corp", nextFollowUpAt: "2026-09-20" })
  assert.ok("value" in result)
  assert.equal(result.value.next_follow_up_at, "2026-09-20T00:00:00.000Z")
})

test("parseClientPipelineInput accepts full ISO datetime follow-up", () => {
  const result = parseClientPipelineInput({ name: "Acme Corp", nextFollowUpAt: "2026-09-20T14:30:00Z" })
  assert.ok("value" in result)
  assert.ok(result.value.next_follow_up_at !== null)
})

test("parseClientPipelineInput parses full valid input", () => {
  const result = parseClientPipelineInput({
    name: "Acme",
    email: "admin@acme.com",
    status: "prospect",
    outreachStatus: "contacted",
    nextFollowUpAt: "2026-10-01",
  })
  assert.ok("value" in result)
  assert.equal(result.value.status, "prospect")
  assert.equal(result.value.outreach_status, "contacted")
  assert.equal(result.value.next_follow_up_at, "2026-10-01T00:00:00.000Z")
})