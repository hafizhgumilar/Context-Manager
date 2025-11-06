import { describe, expect, it } from "vitest";
import { buildOutput, type SectionDto } from "@/lib/output";

function makeSection(partial: Partial<SectionDto>): SectionDto {
  return {
    id: partial.id ?? "id",
    type: partial.type ?? "system_prompt",
    title: partial.title ?? "System Prompt",
    orderIndex: partial.orderIndex ?? 0,
    filename: partial.filename ?? null,
    content: partial.content ?? "",
  };
}

describe("buildOutput", () => {
  it("builds non-attachment blocks with END markers", () => {
    const out = buildOutput([
      makeSection({
        type: "system_prompt",
        title: "System Prompt",
        content: "You are a helpful assistant.",
      }),
    ]);

    expect(out).toContain("╔═══ SYSTEM PROMPT ═══╗");
    expect(out).toContain("╚═══ END OF SYSTEM PROMPT ═══╝");
    expect(out).toContain("You are a helpful assistant.");
  });

  it("builds attachment blocks with filename markers", () => {
    const out = buildOutput([
      makeSection({
        type: "attachment",
        title: "ATTACHMENT: main.py",
        filename: "main.py",
        content: "print('hello world')",
      }),
    ]);

    expect(out).toContain("╔═══ ATTACHMENT: main.py ═══╗");
    expect(out).toContain("╚═══ END OF ATTACHMENT: main.py ═══╝");
  });

  it("skips empty sections and preserves ordering", () => {
    const sections = [
      makeSection({
        type: "system_prompt",
        title: "System Prompt",
        content: "A",
        orderIndex: 1,
      }),
      makeSection({
        type: "user_prompt",
        title: "User Prompt",
        content: "   ",
        orderIndex: 0,
      }),
      makeSection({
        type: "context",
        title: "Context",
        content: "B",
        orderIndex: 2,
      }),
    ];

    const out = buildOutput(sections);
    expect(out).not.toContain("USER PROMPT");
    const blocks = out.split("\n\n");
    expect(blocks[0]).toContain("SYSTEM PROMPT");
    expect(blocks[1]).toContain("CONTEXT");
  });
});
