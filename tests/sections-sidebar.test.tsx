import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach } from "vitest";
import { SectionsSidebar } from "@/components/builder/sections-sidebar";

vi.mock("@/components/builder/section-library", () => ({
  SectionLibrary: ({ onAddSection }: { onAddSection: () => void }) => (
    <div>
      <button type="button" onClick={onAddSection}>
        add-section
      </button>
    </div>
  ),
}));

describe("SectionsSidebar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("respects persisted collapsed state on mount and toggles visibility", async () => {
    localStorage.setItem("sectionsSidebarState", "collapsed");
    localStorage.setItem("sectionsSidebarWidth", "312");

    render(
      <SectionsSidebar
        activeCategory="basic"
        onCategoryChange={() => {}}
        onAddSection={() => {}}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: /sidebar/i,
    });

    await waitFor(() => {
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    });

    const aside = toggle.closest("aside") as HTMLElement;
    expect(aside).not.toBeNull();
    expect(aside.style.width).toBe("56px");

    await userEvent.click(toggle);

    await waitFor(() => {
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(localStorage.getItem("sectionsSidebarState")).toBe("expanded");
    });
  });

  it("supports Alt+\\ keyboard shortcut to toggle", async () => {
    render(
      <SectionsSidebar
        activeCategory="basic"
        onCategoryChange={() => {}}
        onAddSection={() => {}}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: /sidebar/i,
    });

    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(window, { altKey: true, code: "Backslash" });

    await waitFor(() => {
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("uses the persisted width when available", async () => {
    localStorage.setItem("sectionsSidebarWidth", "360");

    render(
      <SectionsSidebar
        activeCategory="basic"
        onCategoryChange={() => {}}
        onAddSection={() => {}}
      />,
    );

    const aside = document.querySelector("aside") as HTMLElement;
    expect(aside).not.toBeNull();
    await waitFor(() => {
      expect(aside.style.width).toBe("360px");
    });
  });
});
