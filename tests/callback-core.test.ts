import assert from "node:assert/strict"
import test from "node:test"
import {
  signCallbackPayload,
  verifyCallbackSignature,
  parseCallbackPayload,
  callbackFingerprint,
  type CallbackPayload,
} from "../src/lib/automation/callback-core"

const SECRET = "test-secret-for-callback-hmac-32bytes!!"
const UUID = "550e8400-e29b-41d4-a716-446655440000"
const UUID2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
const UUID3 = "f47ac10b-58cc-4372-a567-0e02b2c3d479"

function validBody(): Record<string, unknown> {
  return {
    replyflow_run_id: UUID,
    organization_id: UUID2,
    workflow_id: UUID3,
    status: "success",
    execution_id: "exec-123",
    output: { ok: true },
    error_message: null,
    error_code: null,
    occurred_at: "2026-09-03T12:00:00.000Z",
  }
}

function sign(body: string): string {
  return signCallbackPayload(SECRET, body)
}

// ─── HMAC Signature Verification ─────────────────────────────────────────────

test("verifyCallbackSignature returns true for a valid signature", () => {
  const raw = JSON.stringify(validBody())
  const sig = sign(raw)
  assert.equal(verifyCallbackSignature(SECRET, raw, sig), true)
})

test("verifyCallbackSignature rejects a missing signature header", () => {
  const raw = JSON.stringify(validBody())
  assert.equal(verifyCallbackSignature(SECRET, raw, null), false)
  assert.equal(verifyCallbackSignature(SECRET, raw, undefined), false)
})

test("verifyCallbackSignature rejects an empty string signature", () => {
  const raw = JSON.stringify(validBody())
  assert.equal(verifyCallbackSignature(SECRET, raw, ""), false)
})

test("verifyCallbackSignature rejects signature without sha256= prefix", () => {
  const raw = JSON.stringify(validBody())
  const hex = "a".repeat(64)
  assert.equal(verifyCallbackSignature(SECRET, raw, hex), false)
})

test("verifyCallbackSignature rejects signature with wrong prefix casing", () => {
  const raw = JSON.stringify(validBody())
  const hex = "a".repeat(64)
  assert.equal(verifyCallbackSignature(SECRET, raw, `SHA256=${hex}`), false)
})

test("verifyCallbackSignature rejects signature with non-hex chars", () => {
  const raw = JSON.stringify(validBody())
  const badHex = "g" + "a".repeat(63)
  assert.equal(verifyCallbackSignature(SECRET, raw, `sha256=${badHex}`), false)
})

test("verifyCallbackSignature rejects signature that is too short", () => {
  const raw = JSON.stringify(validBody())
  assert.equal(verifyCallbackSignature(SECRET, raw, "sha256=abc"), false)
})

test("verifyCallbackSignature rejects signature that is too long", () => {
  const raw = JSON.stringify(validBody())
  const hex = "a".repeat(65)
  assert.equal(verifyCallbackSignature(SECRET, raw, `sha256=${hex}`), false)
})

test("verifyCallbackSignature rejects tampered body", () => {
  const raw = JSON.stringify(validBody())
  const sig = sign(raw)
  const tampered = JSON.stringify({ ...validBody(), status: "error" })
  assert.equal(verifyCallbackSignature(SECRET, tampered, sig), false)
})

test("verifyCallbackSignature rejects wrong secret", () => {
  const raw = JSON.stringify(validBody())
  const sig = sign(raw)
  assert.equal(verifyCallbackSignature("wrong-secret", raw, sig), false)
})

test("verifyCallbackSignature rejects empty secret", () => {
  const raw = JSON.stringify(validBody())
  const sig = sign(raw)
  assert.equal(verifyCallbackSignature("", raw, sig), false)
})

test("verifyCallbackSignature rejects non-string signature header", () => {
  const raw = JSON.stringify(validBody())
  assert.equal(verifyCallbackSignature(SECRET, raw, 12345 as unknown as string), false)
})

// ─── Payload Parsing ─────────────────────────────────────────────────────────

test("parseCallbackPayload accepts a fully valid payload", () => {
  const result = parseCallbackPayload(validBody())
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.payload.replyflow_run_id, UUID)
    assert.equal(result.payload.organization_id, UUID2)
    assert.equal(result.payload.workflow_id, UUID3)
    assert.equal(result.payload.status, "success")
    assert.equal(result.payload.execution_id, "exec-123")
    assert.deepEqual(result.payload.output, { ok: true })
    assert.equal(result.payload.error_message, null)
    assert.equal(result.payload.error_code, null)
    assert.equal(result.payload.occurred_at, "2026-09-03T12:00:00.000Z")
  }
})

test("parseCallbackPayload rejects null input", () => {
  const result = parseCallbackPayload(null)
  assert.equal(result.ok, false)
})

test("parseCallbackPayload rejects array input", () => {
  const result = parseCallbackPayload([1, 2, 3])
  assert.equal(result.ok, false)
})

test("parseCallbackPayload rejects string input", () => {
  const result = parseCallbackPayload("not an object")
  assert.equal(result.ok, false)
})

test("parseCallbackPayload rejects missing replyflow_run_id", () => {
  const body = { ...validBody() }
  delete (body as Record<string, unknown>).replyflow_run_id
  const result = parseCallbackPayload(body)
  assert.equal(result.ok, false)
})

test("parseCallbackPayload rejects invalid UUID format for run_id", () => {
  const result = parseCallbackPayload({ ...validBody(), replyflow_run_id: "not-a-uuid" })
  assert.equal(result.ok, false)
})

test("parseCallbackPayload rejects invalid UUID for organization_id", () => {
  const result = parseCallbackPayload({ ...validBody(), organization_id: "xxx" })
  assert.equal(result.ok, false)
})

test("parseCallbackPayload rejects invalid UUID for workflow_id", () => {
  const result = parseCallbackPayload({ ...validBody(), workflow_id: 12345 })
  assert.equal(result.ok, false)
})

test("parseCallbackPayload rejects unknown status value", () => {
  const result = parseCallbackPayload({ ...validBody(), status: "unknown" })
  assert.equal(result.ok, false)
})

test("parseCallbackPayload rejects numeric status", () => {
  const result = parseCallbackPayload({ ...validBody(), status: 42 })
  assert.equal(result.ok, false)
})

test("parseCallbackPayload accepts all three valid statuses", () => {
  for (const status of ["success", "error", "cancelled"]) {
    const result = parseCallbackPayload({ ...validBody(), status })
    assert.equal(result.ok, true, `status "${status}" should be accepted`)
  }
})

test("parseCallbackPayload accepts null execution_id", () => {
  const result = parseCallbackPayload({ ...validBody(), execution_id: null })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.execution_id, null)
})

test("parseCallbackPayload accepts undefined execution_id", () => {
  const result = parseCallbackPayload({ ...validBody(), execution_id: undefined })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.execution_id, null)
})

test("parseCallbackPayload accepts empty string execution_id as null", () => {
  const result = parseCallbackPayload({ ...validBody(), execution_id: "" })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.execution_id, null)
})

test("parseCallbackPayload accepts numeric execution_id as string", () => {
  const result = parseCallbackPayload({ ...validBody(), execution_id: 12345 })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.execution_id, "12345")
})

test("parseCallbackPayload rejects execution_id exceeding 256 chars", () => {
  const result = parseCallbackPayload({ ...validBody(), execution_id: "a".repeat(257) })
  assert.equal(result.ok, false)
})

test("parseCallbackPayload accepts error_message up to 4000 chars", () => {
  const result = parseCallbackPayload({ ...validBody(), error_message: "e".repeat(4000) })
  assert.equal(result.ok, true)
})

test("parseCallbackPayload rejects error_message exceeding 4000 chars", () => {
  const result = parseCallbackPayload({ ...validBody(), error_message: "e".repeat(4001) })
  assert.equal(result.ok, false)
})

test("parseCallbackPayload accepts error_code up to 200 chars", () => {
  const result = parseCallbackPayload({ ...validBody(), error_code: "c".repeat(200) })
  assert.equal(result.ok, true)
})

test("parseCallbackPayload rejects error_code exceeding 200 chars", () => {
  const result = parseCallbackPayload({ ...validBody(), error_code: "c".repeat(201) })
  assert.equal(result.ok, false)
})

test("parseCallbackPayload normalizes null optional fields", () => {
  const body = {
    ...validBody(),
    error_message: null,
    error_code: undefined,
    occurred_at: null,
  }
  const result = parseCallbackPayload(body)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.payload.error_message, null)
    assert.equal(result.payload.error_code, null)
    assert.equal(result.payload.occurred_at, null)
  }
})

test("parseCallbackPayload ignores invalid occurred_at string", () => {
  const result = parseCallbackPayload({ ...validBody(), occurred_at: "not-a-date" })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.occurred_at, null)
})

test("parseCallbackPayload defaults output to null when absent", () => {
  const body = { ...validBody() }
  delete (body as Record<string, unknown>).output
  const result = parseCallbackPayload(body)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.payload.output, null)
})

// ─── Fingerprint ─────────────────────────────────────────────────────────────

test("callbackFingerprint produces a deterministic 32-char hex string", () => {
  const payload = parseCallbackPayload(validBody())
  assert.equal(payload.ok, true)
  if (!payload.ok) return

  const fp1 = callbackFingerprint(SECRET, payload.payload)
  const fp2 = callbackFingerprint(SECRET, payload.payload)
  assert.equal(fp1, fp2)
  assert.equal(fp1.length, 32)
  assert.match(fp1, /^[0-9a-f]{32}$/)
})

test("callbackFingerprint changes when status changes", () => {
  const payload1: CallbackPayload = {
    ...validBody() as CallbackPayload,
    status: "success",
  }
  const payload2: CallbackPayload = {
    ...validBody() as CallbackPayload,
    status: "error",
  }
  assert.notEqual(
    callbackFingerprint(SECRET, payload1),
    callbackFingerprint(SECRET, payload2),
  )
})

test("callbackFingerprint changes when run_id changes", () => {
  const payload1: CallbackPayload = {
    ...validBody() as CallbackPayload,
    replyflow_run_id: UUID,
  }
  const payload2: CallbackPayload = {
    ...validBody() as CallbackPayload,
    replyflow_run_id: UUID2,
  }
  assert.notEqual(
    callbackFingerprint(SECRET, payload1),
    callbackFingerprint(SECRET, payload2),
  )
})

// ─── Sign-then-Verify round trip ─────────────────────────────────────────────

test("sign and verify round-trips correctly", () => {
  const bodies = [
    JSON.stringify(validBody()),
    JSON.stringify({ ...validBody(), status: "error", output: null }),
    JSON.stringify({ ...validBody(), execution_id: null }),
    JSON.stringify({ ...validBody(), execution_id: 99999 }),
  ]
  for (const raw of bodies) {
    const sig = sign(raw)
    assert.equal(verifyCallbackSignature(SECRET, raw, sig), true, `round-trip failed for body: ${raw.slice(0, 80)}`)
  }
})

// ─── Malformed payload edge cases ────────────────────────────────────────────

test("parseCallbackPayload rejects extra fields that are not valid types", () => {
  // Extra fields are allowed (they're ignored), but if the core fields are
  // wrong the payload must still be rejected.
  const result = parseCallbackPayload({ foo: "bar", replyflow_run_id: "bad" })
  assert.equal(result.ok, false)
})

test("parseCallbackPayload rejects empty object", () => {
  const result = parseCallbackPayload({})
  assert.equal(result.ok, false)
})

test("parseCallbackPayload accepts extra unknown fields without error", () => {
  const result = parseCallbackPayload({ ...validBody(), extra_field: "ignored" })
  assert.equal(result.ok, true)
})
