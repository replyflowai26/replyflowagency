export type Service = {
  id: string
  number: string
  title: string
  description: string
  detail: string
  steps: string[]
}

export const services: Service[] = [
  {
    id: "lead-generation",
    number: "01",
    title: "Lead Generation",
    description: "Capture, enrich and route leads automatically.",
    detail:
      "Turn prospect discovery into a connected system that captures, enriches and routes qualified leads without repetitive manual work.",
    steps: [
      "Capture prospects",
      "Enrich lead data",
      "Score opportunities",
      "Route qualified leads",
    ],
  },
  {
    id: "sales-automation",
    number: "02",
    title: "Sales Automation",
    description: "Qualify prospects and keep follow-ups moving.",
    detail:
      "Build automated sales workflows that keep prospects moving from first contact to qualified opportunity.",
    steps: [
      "Capture conversations",
      "Qualify prospects",
      "Trigger follow-ups",
      "Track pipeline movement",
    ],
  },
  {
    id: "customer-support",
    number: "03",
    title: "Customer Support",
    description: "Give customers fast, consistent AI-assisted support.",
    detail:
      "Connect AI-assisted support workflows so customers receive fast and consistent answers while your team handles the exceptions.",
    steps: [
      "Receive customer request",
      "Understand intent",
      "Generate response",
      "Escalate when required",
    ],
  },
  {
    id: "operations",
    number: "04",
    title: "Operations",
    description: "Connect repetitive business tasks into reliable workflows.",
    detail:
      "Replace repetitive operational work with connected workflows that execute consistently across your business tools.",
    steps: [
      "Identify repetitive work",
      "Connect business tools",
      "Automate execution",
      "Monitor workflow results",
    ],
  },
  {
    id: "reporting",
    number: "05",
    title: "Reporting",
    description: "Turn operational data into useful decision signals.",
    detail:
      "Convert scattered operational information into clear signals that help the business understand what is happening and what needs attention.",
    steps: [
      "Collect operational data",
      "Structure information",
      "Generate insights",
      "Surface decision signals",
    ],
  },
  {
    id: "custom-ai-systems",
    number: "06",
    title: "Custom AI Systems",
    description: "Design a system around the way your business works.",
    detail:
      "Create a tailored AI automation layer around your company's actual processes, tools and operational requirements.",
    steps: [
      "Audit your workflow",
      "Design system architecture",
      "Connect AI and tools",
      "Optimize and scale",
    ],
  },
]
