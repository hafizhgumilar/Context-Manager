import { z } from "zod";
import { SECTION_TYPE_LIST } from "@/lib/section-taxonomy";

export const SectionTypeEnum = z.enum(SECTION_TYPE_LIST);

export const SectionSchema = z.object({
  id: z.string().optional(),
  type: SectionTypeEnum,
  title: z.string().min(1),
  orderIndex: z.number().int().nonnegative(),
  filename: z.string().nullable().optional(),
  content: z.string().default(""),
});

export const TemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  category: z.string().min(1),
  sections: z.array(SectionSchema),
  isStarred: z.boolean().optional(),
});

export type SectionInput = z.infer<typeof SectionSchema>;
export type TemplateInput = z.infer<typeof TemplateSchema>;
