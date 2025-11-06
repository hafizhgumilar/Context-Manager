import type { SectionType } from "@/lib/section-taxonomy";

export type SectionDto = {
  id?: string;
  type: SectionType | string;
  title: string;
  orderIndex: number;
  filename?: string | null;
  content: string;
};

const START_BORDER = "╔═══ {title} ═══╗";
const END_BORDER = "╚═══ END OF {title} ═══╝";
const ATTACHMENT_START = "╔═══ ATTACHMENT: {title} ═══╗";
const ATTACHMENT_END = "╚═══ END OF ATTACHMENT: {title} ═══╝";

function formatStart(title: string, isAttachment: boolean) {
  if (isAttachment) {
    return ATTACHMENT_START.replace("{title}", title);
  }
  return START_BORDER.replace("{title}", title);
}

function formatEnd(title: string, isAttachment: boolean) {
  if (isAttachment) {
    return ATTACHMENT_END.replace("{title}", title);
  }
  return END_BORDER.replace("{title}", title);
}

export function buildOutput(sections: SectionDto[]): string {
  return sections
    .filter((section) => section.content?.trim().length)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((section) => {
      const isAttachment =
        section.type === "attachment" && Boolean(section.filename);
      const attachmentTitle = section.filename ?? "";
      const normalizedTitle = isAttachment
        ? `ATTACHMENT: ${attachmentTitle}`
        : section.title.toUpperCase();

      return [
        formatStart(
          isAttachment ? attachmentTitle : normalizedTitle,
          isAttachment,
        ),
        section.content,
        formatEnd(
          isAttachment ? attachmentTitle : section.title.toUpperCase(),
          isAttachment,
        ),
      ].join("\n");
    })
    .join("\n\n");
}
