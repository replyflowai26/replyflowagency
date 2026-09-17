import assert from "node:assert/strict"
import test from "node:test"
import { runGuardedSubmit, fallbackErrorState } from "../src/lib/forms/guarded-submit.js"

test("runGuardedSubmit resets loading after a successful save", async () => {
  let settled = 0
  const settledState = { success: "Client updated successfully." }
  const result = await runGuardedSubmit<{ error?: string; success?: string }>({
    execute: async () => settledState,
    onResolved: () => {},
    onRejected: () => {},
    onSettled: () => {
      settled += 1
    },
  })
  assert.equal(result, settledState)
  assert.equal(settled, 1)
})

test("runGuardedSubmit resets loading after a failed save", async () => {
  let settled = 0
  const errorState = { error: "Something went wrong." }
  const result = await runGuardedSubmit<{ error?: string; success?: string }>({
    execute: async () => errorState,
    onResolved: () => {},
    onRejected: () => {},
    onSettled: () => {
      settled += 1
    },
  })
  assert.equal(result, errorState)
  assert.equal(settled, 1)
})

test("runGuardedSubmit resets loading after a thrown exception", async () => {
  let settled = 0
  let rejected = 0
  const result = await runGuardedSubmit<{ error?: string; success?: string }>({
    execute: async () => {
      throw new Error("boom")
    },
    onResolved: () => {},
    onRejected: (next) => {
      rejected += 1
      assert.equal(next.error, "Unable to save client. Please try again.")
    },
    onSettled: () => {
      settled += 1
    },
    errorMessage: "Unable to save client. Please try again.",
  })
  assert.equal(rejected, 1)
  assert.equal(settled, 1)
  assert.ok(result.error)
})

test("fallbackErrorState shapes a generic error state", () => {
  assert.deepEqual(fallbackErrorState("Unable to save client. Please try again."), {
    error: "Unable to save client. Please try again.",
  })
})