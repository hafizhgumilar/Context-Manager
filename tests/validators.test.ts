import { describe, expect, it } from "vitest";
import { RegisterSchema } from "@/lib/validators/auth";
import { TemplateSchema } from "@/lib/validators/template";

describe("RegisterSchema", () => {
  it("accepts valid registration data", () => {
    const result = RegisterSchema.safeParse({
      email: "user@example.com",
      name: "User",
      password: "supersecure",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = RegisterSchema.safeParse({
      email: "not-an-email",
      name: "User",
      password: "supersecure",
    });
    expect(result.success).toBe(false);
  });
});

describe("TemplateSchema", () => {
  it("enforces required fields and section structure", () => {
    const result = TemplateSchema.safeParse({
      name: "My template",
      category: "basic",
      sections: [
        {
          type: "system_prompt",
          title: "System Prompt",
          orderIndex: 0,
          content: "You are helpful.",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("allows attachments without filenames", () => {
    const result = TemplateSchema.safeParse({
      name: "Attachment template",
      category: "basic",
      sections: [
        {
          type: "attachment",
          title: "Attachment",
          orderIndex: 0,
          filename: null,
          content: "file contents",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects sections without titles", () => {
    const result = TemplateSchema.safeParse({
      name: "Another template",
      category: "basic",
      sections: [
        {
          type: "system_prompt",
          title: "",
          orderIndex: 0,
          content: "Missing title",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
