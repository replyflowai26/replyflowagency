# Workflow Templates Library

## Purpose

Provide a reusable, validated foundation for ReplyFlow AI automation templates so the
same six core automations can be delivered to many clients without copy-paste and
without touching execution code.

This library is **definition-only**. A template describes a trigger, steps,
integrations, input/output schemas, approval gates and an n8n mapping hint. It never
executes anything. Execution stays in `src/lib/automation/*`, which remains the single
authoritative run path (`queueWorkflowRun` → dispatch → n8n → callback → atomic
transition).

## Relationship to the existing runtime

| Concern | Owner |
| --- | --- |
| Template + version definitions, schemas, gates | `src/lib/workflows/*` (this library) |
| Run status transitions | `src/lib/automation/run-state-machine.ts` |
| Dispatch + n8n adapter | `src/lib/automation/execution-service.ts`, `n8n.ts`, `n8n-dispatch-core.ts` |
| Callback reconciliation | `src/lib/automation/callback-*.ts`, `atomic-transition.ts` |
| Run history / error reporting | `workflow_run_events` + `src/lib/dashboard/run-observability*.ts` |
| Integrations + credential references | `integration_connections` (metadata + `secret_ref` only) |

The library reuses `isSafeN8nWebhookPath` from `src/lib/automation/webhook.ts` and mirrors
the `trigger_type` and `integration_connections.provider` constraints from the migrations.
It does **not** introduce a second status model.

## Folder structure

```text
src/lib/workflows/
  types.ts        Template, version, trigger, step, integration, gate, plan types
  validation.ts   Pure, dependency-free parsers + catalog integrity checks
  catalog.ts      The six starter templates (metadata only)
  instantiate.ts  Pure planner: template + client config -> workflows-row plan
  index.ts        Public surface
tests/
  workflow-template-library.test.ts   Catalog + validation + planner tests
Docs/architecture/
  workflow-templates-library.md                    This document
  proposed_workflow_templates_schema.sql           PROPOSAL ONLY — not applied
```

## Concepts

- **Template** — `id` (slug), `name`, `category`, `summary`, `version` (semver),
  `status`, `trigger`, `inputSchema`, `outputSchema`, `steps`, `requiredIntegrations`,
  `approvalGates`, `n8n`, optional `aiAgent`.
- **Versioning** — `version` is semver with a lifecycle `status`
  (`draft` | `published` | `deprecated` | `archived`). History persistence is proposed,
  not applied (see the SQL proposal).
- **Trigger** — a discriminated union. `type` is one of the values permitted by
  `workflow_runs.trigger_type`: `manual`, `schedule`, `webhook`, `system`. Scheduled
  triggers carry `cron` + `timezone`; webhooks carry a safe relative `pathHint`.
- **Step** — `id` (slug), `kind` (`trigger` | `condition` | `action` | `integration` |
  `delay` | `approval` | `ai-agent` | `transform`), `name`, optional `integration`,
  optional approval requirement.
- **Input/output schema** — a small, dependency-free field list
  (`string` | `text` | `number` | `boolean` | `email` | `phone` | `datetime` | `enum` |
  `json`) with `required` flags.
- **Integration reference** — `provider` (mirrors `integration_connections.provider`) +
  `credentialRef` + `optional`. `credentialRef` must be a **reference**, never a secret.
- **Credential reference** — must carry an explicit scheme: `vault:`, `env:` or
  `integration:`. Bare tokens, AWS keys and bearer strings are rejected.
- **Approval gate** — human-in-the-loop: `{ id, stepId, role, reason }`. `stepId` must
  reference a real step.
- **Client configuration** — per-client `values` overriding template input defaults.
  Unknown keys produce warnings, never silent acceptance.
- **AI agent hint** — advisory orchestration metadata only; no model is invoked here.
- **Instantiation plan** — `planWorkflowInstantiation()` returns a plain object with
  `executable: false`, `n8n.workflowId: null`, and the list of **missing** required
  integrations. It plans; it never runs.

## Safety rules

- Templates are never executed directly; dispatch only happens through the existing runtime.
- Credentials are references only. `integration_connections.secret_ref` is a pointer; the
  library enforces the same discipline with `isSafeCredentialRef`.
- Cross-field invariants are enforced (unique step ids, gates reference real steps, unique
  providers) so a malformed template fails tests instead of production.
- Integration availability is never assumed: if `availableProviders` is omitted from the
  planner, availability is reported as unverified rather than "present".

## Implemented vs planned

**Implemented (code, tested):**
- Template/trigger/step/integration/gate/schema types and guards.
- Pure validation with cross-field invariants and credential-reference safety.
- Six-template catalog (lead capture & qualification, follow-up sequence, appointment
  booking, CRM synchronization, customer support routing, weekly reporting).
- Execution-free instantiation planner with missing-integration reporting.

**Planned (proposed, not built):**
- Database persistence for templates + version history (see SQL proposal).
- Instantiation server action wiring template → `workflows` row via the existing path.
- Per-client config storage and approval-gate workflow UI.
- n8n mapping templating and AI-agent runtime orchestration.

## Testing

Pure modules are included in `tsconfig.bridge-test.json` and exercised by
`tests/workflow-template-library.test.ts` (`node --test`). Run `npm run test:bridge`.
