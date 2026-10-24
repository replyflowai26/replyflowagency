// The starter workflow-template catalog.
//
// Six small, honest templates — metadata only. None of them claims to execute:
// each describes its trigger, steps, integrations, approval gates and n8n
// mapping requirement. Actual execution is wired later through the existing
// automation runtime (src/lib/automation/*), which is the ONLY path that may
// dispatch a run. Adding a template here changes nothing at runtime.
//
// The catalog is validated at test time by `validateTemplateCatalog`, so a
// malformed template fails the build/test suite rather than production.

import type { WorkflowTemplate } from "./types"

export const WORKFLOW_TEMPLATES: readonly WorkflowTemplate[] = [
  {
    id: "lead-capture-qualification",
    name: "Lead Capture & Qualification",
    category: "lead-capture",
    summary:
      "Intake a new lead from a form or webhook, qualify it, store it as a client and notify the team.",
    version: "1.0.0",
    status: "published",
    trigger: { type: "webhook", pathHint: "replyflow-lead-intake" },
    inputSchema: {
      fields: [
        { key: "name", label: "Full name", type: "string", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "phone", label: "Phone", type: "phone", required: false },
        { key: "company", label: "Company", type: "string", required: false },
        { key: "message", label: "Message", type: "text", required: false },
        {
          key: "source",
          label: "Source",
          type: "enum",
          required: false,
          enumValues: ["website", "ads", "referral", "other"],
        },
      ],
    },
    outputSchema: {
      fields: [
        { key: "client_id", label: "Client id", type: "string", required: true },
        { key: "qualified", label: "Qualified", type: "boolean", required: true },
        { key: "score", label: "Fit score", type: "number", required: false },
        { key: "assigned_to", label: "Assigned to", type: "string", required: false },
      ],
    },
    steps: [
      { id: "intake", kind: "trigger", name: "Receive lead", description: "Accept the webhook/form payload." },
      { id: "qualify", kind: "ai-agent", name: "Qualify lead", description: "Score the lead against the ideal-customer profile." },
      { id: "persist", kind: "action", name: "Create client record", description: "Store the lead in the client pipeline." },
      {
        id: "notify",
        kind: "integration",
        name: "Notify sales channel",
        requiresApproval: true,
        approvalRole: "owner",
        integration: { provider: "messaging", credentialRef: "vault:integrations/messaging", optional: true },
      },
    ],
    requiredIntegrations: [
      { provider: "crm", credentialRef: "vault:integrations/crm", optional: false },
      { provider: "messaging", credentialRef: "vault:integrations/messaging", optional: true },
    ],
    approvalGates: [
      { id: "gate-hot-lead", stepId: "notify", role: "owner", reason: "Owner approves outreach to high-value leads." },
    ],
    n8n: { requiresMapping: true, pathHint: "replyflow-lead-intake" },
    aiAgent: { role: "lead-qualifier", requiresHumanApproval: false },
  },

  {
    id: "follow-up-sequence",
    name: "Follow-up Sequence",
    category: "follow-up",
    summary:
      "On a daily schedule, find clients due for follow-up and send a sequenced message.",
    version: "1.0.0",
    status: "published",
    trigger: { type: "schedule", cron: "0 9 * * 1-5", timezone: "UTC" },
    inputSchema: {
      fields: [
        { key: "lookback_days", label: "Lookback window (days)", type: "number", required: false },
        {
          key: "channel",
          label: "Channel",
          type: "enum",
          required: false,
          enumValues: ["email", "whatsapp"],
        },
        { key: "max_per_run", label: "Max messages per run", type: "number", required: false },
      ],
    },
    outputSchema: {
      fields: [
        { key: "processed", label: "Processed", type: "number", required: true },
        { key: "sent", label: "Sent", type: "number", required: true },
        { key: "skipped", label: "Skipped", type: "number", required: true },
      ],
    },
    steps: [
      { id: "schedule", kind: "trigger", name: "Daily schedule" },
      { id: "select-due", kind: "action", name: "Select due follow-ups" },
      { id: "send", kind: "integration", name: "Send follow-up", integration: { provider: "messaging", credentialRef: "vault:integrations/messaging", optional: false } },
      { id: "wait", kind: "delay", name: "Wait between sends" },
      {
        id: "escalate",
        kind: "action",
        name: "Escalate non-responders",
        requiresApproval: true,
        approvalRole: "admin",
      },
    ],
    requiredIntegrations: [
      { provider: "messaging", credentialRef: "vault:integrations/messaging", optional: false },
    ],
    approvalGates: [
      { id: "gate-escalation", stepId: "escalate", role: "admin", reason: "Admin approves escalations before they are sent." },
    ],
    n8n: { requiresMapping: true, pathHint: "replyflow-follow-up" },
  },

  {
    id: "appointment-booking",
    name: "Appointment Booking",
    category: "booking",
    summary:
      "Accept a booking request, validate it, create the calendar event and confirm with the client.",
    version: "1.0.0",
    status: "published",
    trigger: { type: "webhook", pathHint: "replyflow-booking-intake" },
    inputSchema: {
      fields: [
        { key: "name", label: "Full name", type: "string", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "preferred_at", label: "Preferred time", type: "datetime", required: true },
        { key: "timezone", label: "Timezone", type: "string", required: false },
        { key: "notes", label: "Notes", type: "text", required: false },
      ],
    },
    outputSchema: {
      fields: [
        { key: "booking_id", label: "Booking id", type: "string", required: true },
        { key: "confirmed", label: "Confirmed", type: "boolean", required: true },
        { key: "calendar_event_ref", label: "Calendar event ref", type: "string", required: false },
      ],
    },
    steps: [
      { id: "request", kind: "trigger", name: "Receive booking request" },
      { id: "validate", kind: "condition", name: "Validate availability" },
      { id: "book", kind: "action", name: "Create booking" },
      { id: "calendar", kind: "integration", name: "Create calendar event", integration: { provider: "calendar", credentialRef: "vault:integrations/calendar", optional: false } },
      { id: "confirm", kind: "action", name: "Send confirmation" },
    ],
    requiredIntegrations: [
      { provider: "calendar", credentialRef: "vault:integrations/calendar", optional: false },
      { provider: "messaging", credentialRef: "vault:integrations/messaging", optional: true },
    ],
    approvalGates: [],
    n8n: { requiresMapping: true, pathHint: "replyflow-booking-intake" },
  },

  {
    id: "crm-synchronization",
    name: "CRM Synchronization",
    category: "crm-sync",
    summary:
      "Reconcile client records with the CRM on a nightly schedule, flagging conflicts for review.",
    version: "1.0.0",
    status: "published",
    trigger: { type: "schedule", cron: "0 3 * * *", timezone: "UTC" },
    inputSchema: {
      fields: [
        {
          key: "direction",
          label: "Direction",
          type: "enum",
          required: true,
          enumValues: ["push", "pull", "bidirectional"],
        },
        { key: "since_days", label: "Since (days)", type: "number", required: false },
      ],
    },
    outputSchema: {
      fields: [
        { key: "pushed", label: "Pushed", type: "number", required: true },
        { key: "pulled", label: "Pulled", type: "number", required: true },
        { key: "conflicts", label: "Conflicts", type: "number", required: true },
      ],
    },
    steps: [
      { id: "schedule", kind: "trigger", name: "Nightly schedule" },
      { id: "pull", kind: "integration", name: "Pull CRM records", integration: { provider: "crm", credentialRef: "vault:integrations/crm", optional: false } },
      { id: "map", kind: "transform", name: "Map fields" },
      {
        id: "push",
        kind: "integration",
        name: "Push CRM records",
        requiresApproval: true,
        approvalRole: "admin",
        integration: { provider: "crm", credentialRef: "vault:integrations/crm", optional: false },
      },
      { id: "report", kind: "action", name: "Record sync summary" },
    ],
    requiredIntegrations: [
      { provider: "crm", credentialRef: "vault:integrations/crm", optional: false },
    ],
    approvalGates: [
      { id: "gate-conflicts", stepId: "push", role: "admin", reason: "Admin resolves conflicting CRM records before overwrite." },
    ],
    n8n: { requiresMapping: true, pathHint: "replyflow-crm-sync" },
  },

  {
    id: "customer-support-routing",
    name: "Customer Support Routing",
    category: "support-routing",
    summary:
      "Triage an inbound support request, route it to the right queue and notify the team.",
    version: "1.0.0",
    status: "published",
    trigger: { type: "webhook", pathHint: "replyflow-support-intake" },
    inputSchema: {
      fields: [
        { key: "subject", label: "Subject", type: "string", required: true },
        { key: "message", label: "Message", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        {
          key: "priority",
          label: "Priority",
          type: "enum",
          required: false,
          enumValues: ["low", "normal", "high", "urgent"],
        },
      ],
    },
    outputSchema: {
      fields: [
        { key: "ticket_id", label: "Ticket id", type: "string", required: true },
        { key: "routed_to", label: "Routed to", type: "string", required: true },
        { key: "priority", label: "Priority", type: "string", required: false },
      ],
    },
    steps: [
      { id: "intake", kind: "trigger", name: "Receive request" },
      { id: "triage", kind: "ai-agent", name: "Triage request", description: "Classify intent and urgency." },
      { id: "route", kind: "condition", name: "Route to queue" },
      { id: "notify", kind: "integration", name: "Notify helpdesk", integration: { provider: "helpdesk", credentialRef: "vault:integrations/helpdesk", optional: false } },
      {
        id: "escalate",
        kind: "action",
        name: "Escalate urgent tickets",
        requiresApproval: true,
        approvalRole: "owner",
      },
    ],
    requiredIntegrations: [
      { provider: "helpdesk", credentialRef: "vault:integrations/helpdesk", optional: false },
      { provider: "messaging", credentialRef: "vault:integrations/messaging", optional: true },
    ],
    approvalGates: [
      { id: "gate-sensitive", stepId: "escalate", role: "owner", reason: "Owner approves handling of sensitive or urgent escalations." },
    ],
    n8n: { requiresMapping: true, pathHint: "replyflow-support-intake" },
    aiAgent: { role: "support-triage", requiresHumanApproval: false },
  },

  {
    id: "weekly-reporting",
    name: "Weekly Reporting",
    category: "reporting",
    summary:
      "Aggregate the week's activity, draft a client-ready summary and email it after owner approval.",
    version: "1.0.0",
    status: "published",
    trigger: { type: "schedule", cron: "0 8 * * 1", timezone: "UTC" },
    inputSchema: {
      fields: [
        { key: "recipients", label: "Recipients", type: "string", required: false },
        { key: "include_failed_runs", label: "Include failed runs", type: "boolean", required: false },
        { key: "since_days", label: "Since (days)", type: "number", required: false },
      ],
    },
    outputSchema: {
      fields: [
        { key: "report_id", label: "Report id", type: "string", required: true },
        { key: "summary", label: "Summary", type: "text", required: true },
        { key: "delivered", label: "Delivered", type: "boolean", required: true },
      ],
    },
    steps: [
      { id: "schedule", kind: "trigger", name: "Weekly schedule" },
      { id: "aggregate", kind: "action", name: "Aggregate activity" },
      { id: "summarize", kind: "ai-agent", name: "Draft summary" },
      {
        id: "send",
        kind: "integration",
        name: "Email report",
        requiresApproval: true,
        approvalRole: "owner",
        integration: { provider: "email", credentialRef: "vault:integrations/email", optional: false },
      },
    ],
    requiredIntegrations: [
      { provider: "email", credentialRef: "vault:integrations/email", optional: false },
    ],
    approvalGates: [
      { id: "gate-report-send", stepId: "send", role: "owner", reason: "Owner approves the report before it is emailed to the client." },
    ],
    n8n: { requiresMapping: true, pathHint: "replyflow-weekly-report" },
    aiAgent: { role: "report-writer", requiresHumanApproval: true },
  },
]

export function findWorkflowTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((template) => template.id === id)
}

export function listWorkflowTemplateIds(): string[] {
  return WORKFLOW_TEMPLATES.map((template) => template.id)
}
