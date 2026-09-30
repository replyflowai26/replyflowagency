import assert from "node:assert/strict"
import test from "node:test"
import { formatRunEventTime } from "../src/lib/dashboard/format-run-event-time.js"

test("run event timestamps format in the requested local timezone", () => {
  const timestamp = "2026-09-30T12:29:51.000Z"

  const utc = formatRunEventTime(timestamp, "UTC", "en-GB")
  const india = formatRunEventTime(timestamp, "Asia/Kolkata", "en-GB")

  assert.notEqual(utc, india)
  assert.match(utc, /12:29/)
  assert.match(india, /17:59/)
})

test("invalid run event timestamps remain unchanged", () => {
  assert.equal(formatRunEventTime("not-a-date", "UTC", "en-GB"), "not-a-date")
})
