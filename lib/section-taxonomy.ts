export type TemplateCategory =
  | "basic"
  | "creative"
  | "researchers"
  | "business"
  | "students"
  | "programmer";

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  basic: "Basic Template",
  creative: "Creative Template",
  researchers: "Researchers Template",
  business: "Business Template",
  students: "Students Template",
  programmer: "Programmer Template",
};

export const TEMPLATE_CATEGORIES: {
  id: TemplateCategory;
  label: string;
  sectionTypes: SectionType[];
}[] = [
  {
    id: "basic",
    label: TEMPLATE_CATEGORY_LABELS.basic,
    sectionTypes: [
      "system_prompt",
      "user_prompt",
      "context",
      "objectives",
      "constraints",
      "attachment",
      "reference",
      "examples",
    ],
  },
  {
    id: "creative",
    label: TEMPLATE_CATEGORY_LABELS.creative,
    sectionTypes: [
      "creative_brief",
      "inspiration",
      "brand_guidelines",
      "target_audience",
      "mood_board",
      "constraints",
      "notes",
    ],
  },
  {
    id: "researchers",
    label: TEMPLATE_CATEGORY_LABELS.researchers,
    sectionTypes: [
      "research_question",
      "methodology",
      "data_set",
      "literature_review",
      "hypothesis",
      "variables",
      "limitations",
    ],
  },
  {
    id: "business",
    label: TEMPLATE_CATEGORY_LABELS.business,
    sectionTypes: [
      "context",
      "objectives",
      "background_info",
      "stakeholders",
      "timeline",
      "budget_constraints",
      "deliverables",
    ],
  },
  {
    id: "students",
    label: TEMPLATE_CATEGORY_LABELS.students,
    sectionTypes: [
      "assignment_brief",
      "reference_material",
      "rubric",
      "draft_work",
      "feedback_received",
      "constraints",
      "notes",
    ],
  },
  {
    id: "programmer",
    label: TEMPLATE_CATEGORY_LABELS.programmer,
    sectionTypes: [
      "system_prompt",
      "user_prompt",
      "attachment",
      "error_log",
      "requirements",
      "constraints",
      "previous_output",
    ],
  },
];

export const SECTION_TYPE_LIST = [
  "system_prompt",
  "user_prompt",
  "context",
  "objectives",
  "constraints",
  "attachment",
  "reference",
  "examples",
  "creative_brief",
  "inspiration",
  "brand_guidelines",
  "target_audience",
  "mood_board",
  "notes",
  "research_question",
  "methodology",
  "data_set",
  "literature_review",
  "hypothesis",
  "variables",
  "limitations",
  "background_info",
  "stakeholders",
  "timeline",
  "budget_constraints",
  "deliverables",
  "assignment_brief",
  "reference_material",
  "rubric",
  "draft_work",
  "feedback_received",
  "previous_output",
  "error_log",
  "requirements",
] as const;

export type SectionType = (typeof SECTION_TYPE_LIST)[number];

export type SectionDefinition = {
  type: SectionType;
  title: string;
  description: string;
  category: TemplateCategory;
  isAttachment?: boolean;
};

const DESCRIPTIONS: Partial<Record<SectionType, string>> = {
  system_prompt: "Set the assistant rules or persona.",
  user_prompt: "Primary instruction or question for the model.",
  context: "Supporting context the assistant should know.",
  objectives: "Goals or desired outcomes for the session.",
  constraints: "Rules, limits, or formatting constraints.",
  attachment: "File attachment with filename + content.",
  reference: "Important references or resources.",
  examples: "Illustrative examples or patterns.",
  creative_brief: "High-level creative brief for ideation.",
  inspiration: "Sources or themes to draw inspiration from.",
  brand_guidelines: "Voice, tone, and branding constraints.",
  target_audience: "Who the message/product is for.",
  mood_board: "Descriptive mood or style cues.",
  notes: "Miscellaneous notes or reminders.",
  research_question: "Primary research question or topic.",
  methodology: "Approach, process, or methodology details.",
  data_set: "Datasets or inputs the research uses.",
  literature_review: "Prior work and citations.",
  hypothesis: "Hypothesis or assumptions to validate.",
  variables: "Independent/dependent variables outline.",
  limitations: "Known limits, biases, or risks.",
  background_info: "Organizational or project background.",
  stakeholders: "Stakeholders and their roles.",
  timeline: "Key dates, milestones, or schedule.",
  budget_constraints: "Financial constraints or ranges.",
  deliverables: "Expected outputs or assets.",
  assignment_brief: "Summary of the assignment or task.",
  reference_material: "Supporting materials or resources.",
  rubric: "Grading rubric or expectations.",
  draft_work: "Current draft or progress notes.",
  feedback_received: "Feedback gathered so far.",
  previous_output: "Prior outputs from the assistant.",
  error_log: "Errors or stack traces for debugging.",
  requirements: "Functional or technical requirements.",
};

export const SECTION_DEFINITIONS: Record<SectionType, SectionDefinition> =
  SECTION_TYPE_LIST.reduce((acc, type) => {
    const category =
      TEMPLATE_CATEGORIES.find((entry) =>
        entry.sectionTypes.includes(type),
      )?.id ?? "basic";

    const title = type
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    acc[type] = {
      type,
      title,
      category,
      isAttachment: type === "attachment",
      description:
        DESCRIPTIONS[type] ??
        "Add structured context for this part of your template.",
    };
    return acc;
  }, {} as Record<SectionType, SectionDefinition>);

export const FAVORITE_SECTION_TYPES: SectionType[] = [
  "system_prompt",
  "user_prompt",
  "context",
  "objectives",
  "constraints",
  "attachment",
  "reference",
];

export function createSectionDraft(type: SectionType) {
  const definition = SECTION_DEFINITIONS[type];
  return {
    type: definition.type,
    title: definition.title,
    content: "",
    orderIndex: 0,
    filename: definition.isAttachment ? "attachment.txt" : undefined,
  };
}

