import { test, expect } from "@playwright/test";

// ASSUMPTION: These headless smoke tests exercise the guest builder path.
test.describe("Builder", () => {
  test("guest can add section and copy output", async ({ page }) => {
    await page.goto("/builder");

    await expect(page.getByText("Add section").first()).toBeVisible();

    await page.getByRole("button", { name: "Add section" }).first().click();
    await page.getByRole("button", { name: "Add section" }).first().click();

    const textarea = page.getByRole("textbox", { name: "Template name" });
    await textarea.fill("Smoke Template");

    const sectionTextarea = page.locator("textarea").first();
    await sectionTextarea.fill("You are a test assistant.");

    const copyButton = page.getByRole("button", { name: "Copy" });
    await copyButton.click();

    await expect(page.getByText("Context copied")).toBeVisible();
  });
});
