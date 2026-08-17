# Dispatch Reliability

## Scope

This document defines how ReplyFlow AI dispatches a workflow run to n8n without creating duplicate executions during transient failures.

## Retry policy

The n8n adapter allows up to 3 attempts.

Retryable HTTP responses:

- 408 Request Timeout
- 425 Too Early
- 429 Too Many Requests
- 5xx server errors

Network failures and request timeouts are also retried.

Non-retryable 4xx responses fail immediately.

Backoff starts at 500ms and grows exponentially, with a 4s cap. A valid `Retry-After` header is respected up to 10s.

## Idempotency

Every attempt uses the same `Idempotency-Key`, equal to the internal `workflow_runs.id`. This is critical: retries must represent the same logical run, not new business executions.

## Run state

The execution service moves a run:

`queued → running → succeeded|failed|cancelled`

Only a run in `running` state can receive a terminal n8n callback.

## Observability

Successful dispatch events record the number of adapter attempts and the external n8n execution ID. This allows operations to distinguish a first-attempt success from a recovered transient failure.

## Production follow-up

Before high-volume execution, add a durable queue/lease worker so long-running dispatches are not tied to a single HTTP/server-action lifecycle. Add metrics for retry rate, dispatch latency, and stuck `running` runs.
