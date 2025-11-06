const useMediaQueryMock = vi.fn<(query: string) => boolean>();
const useSectionObserverMock = vi.fn<
  () => {
    activeSectionId: string | null;
    visitedCount: number;
    visibleSectionIds: string[];
  }
>();

vi.mock("@/hooks/use-prefers-reduced-motion", () => ({
  usePrefersReducedMotion: () => false,
}));

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: (query: string) => useMediaQueryMock(query),
}));

vi.mock("@/hooks/use-section-observer", () => ({
  useSectionObserver: () => useSectionObserverMock(),
}));

import React, { useRef, type ReactNode } from "react";
import { act } from "react-dom/test-utils";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { QuickJumpPanel } from "@/components/builder/quick-jump-panel";
import {
  useBuilderStore,
  type BuilderSection,
} from "@/lib/store/builder-store";

function resetBuilderStore() {
  act(() => {
    useBuilderStore.getState().reset();
  });
}

function seedBuilderSections(sections: BuilderSection[]) {
  act(() => {
    useBuilderStore.setState((state) => ({
      ...state,
      sectionOrder: sections.map((section) => section.id),
      sectionsById: sections.reduce<Record<string, BuilderSection>>(
        (accumulator, section) => {
          accumulator[section.id] = section;
          return accumulator;
        },
        {},
      ),
    }));
  });
}

function QuickJumpTestHarness({
  children,
}: {
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  return (
    <div>
      <div ref={scrollRef}>
        <div
          data-radix-scroll-area-viewport
          style={{ maxHeight: "400px", overflowY: "auto" }}
        >
          {children}
        </div>
      </div>
      <QuickJumpPanel scrollAreaRef={scrollRef} />
    </div>
  );
}

function SectionStub({ id, title }: { id: string; title: string }) {
  return (
    <div
      data-builder-section-id={id}
      style={{ height: "48px", marginBottom: "8px" }}
    >
      {title}
    </div>
  );
}

describe("QuickJumpPanel", () => {
  beforeEach(() => {
    resetBuilderStore();
    useMediaQueryMock.mockReset();
    useSectionObserverMock.mockReset();
    useSectionObserverMock.mockReturnValue({
      activeSectionId: null,
      visitedCount: 0,
      visibleSectionIds: [],
    });
  });

  it("reveals the desktop panel on hover and jumps to the selected section", async () => {
    const user = userEvent.setup();
    useMediaQueryMock.mockReturnValue(true);
    useSectionObserverMock.mockReturnValue({
      activeSectionId: null,
      visitedCount: 1,
      visibleSectionIds: [],
    });

    seedBuilderSections([
      {
        id: "alpha",
        type: "system_prompt",
        title: "Alpha Section",
        content: "",
        orderIndex: 0,
      },
      {
        id: "beta",
        type: "user_prompt",
        title: "Beta Section",
        content: "",
        orderIndex: 1,
      },
    ]);

    render(
      <QuickJumpTestHarness>
        <SectionStub id="alpha" title="Alpha Section" />
        <SectionStub id="beta" title="Beta Section" />
      </QuickJumpTestHarness>,
    );

    const panel = screen.getByTestId("quick-jump-panel");
    expect(panel.className).toContain("opacity-0");

    const hotzone = screen.getByTestId("quick-jump-hotzone");
    await act(async () => {
      fireEvent.pointerEnter(hotzone);
    });

    expect(panel.className).toContain("opacity-100");

    const alphaElement = document.querySelector<HTMLElement>(
      '[data-builder-section-id="alpha"]',
    );
    expect(alphaElement).not.toBeNull();
    if (!alphaElement) return;
    const scrollSpy = vi.fn();
    alphaElement.scrollIntoView = scrollSpy;

    const alphaButton = within(panel).getByRole("button", {
      name: /Alpha Section/i,
    });
    await user.click(alphaButton);

    expect(scrollSpy).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
    expect(
      alphaElement.getAttribute("data-builder-section-highlighted"),
    ).toBe("true");

    await waitFor(
      () =>
        expect(
          alphaElement.getAttribute("data-builder-section-highlighted"),
        ).toBeNull(),
      { timeout: 1200 },
    );

    await user.click(
      within(panel).getByRole("button", { name: "Hide quick jump panel" }),
    );

    await waitFor(
      () => {
        expect(panel.className).toContain("opacity-0");
      },
      { timeout: 1200 },
    );
  });

  it("marks the observed section as current", async () => {
    const user = userEvent.setup();
    useMediaQueryMock.mockReturnValue(true);
    useSectionObserverMock.mockReturnValue({
      activeSectionId: "beta",
      visitedCount: 2,
      visibleSectionIds: ["beta"],
    });

    seedBuilderSections([
      {
        id: "alpha",
        type: "system_prompt",
        title: "Alpha Section",
        content: "",
        orderIndex: 0,
      },
      {
        id: "beta",
        type: "user_prompt",
        title: "Beta Section",
        content: "",
        orderIndex: 1,
      },
    ]);

    render(
      <QuickJumpTestHarness>
        <SectionStub id="alpha" title="Alpha Section" />
        <SectionStub id="beta" title="Beta Section" />
      </QuickJumpTestHarness>,
    );

    const panel = screen.getByTestId("quick-jump-panel");
    const hotzone = screen.getByTestId("quick-jump-hotzone");
    await act(async () => {
      fireEvent.pointerEnter(hotzone);
    });

    expect(panel.className).toContain("opacity-100");

    const betaButton = within(panel).getByRole("button", {
      name: /Beta Section/i,
    });
    expect(within(betaButton).getByText(/Current/i)).toBeInTheDocument();

    const alphaButton = within(panel).getByRole("button", {
      name: /Alpha Section/i,
    });
    expect(within(alphaButton).queryByText(/Current/i)).toBeNull();

    await user.click(
      within(panel).getByRole("button", { name: "Hide quick jump panel" }),
    );
  });

  it("uses the floating action button on mobile to toggle the sheet", async () => {
    const user = userEvent.setup();
    useMediaQueryMock.mockReturnValue(false);
    useSectionObserverMock.mockReturnValue({
      activeSectionId: null,
      visitedCount: 3,
      visibleSectionIds: [],
    });

    seedBuilderSections([
      {
        id: "gamma",
        type: "system_prompt",
        title: "Gamma Section",
        content: "",
        orderIndex: 0,
      },
    ]);

    render(
      <QuickJumpTestHarness>
        <SectionStub id="gamma" title="Gamma Section" />
      </QuickJumpTestHarness>,
    );

    expect(screen.queryByTestId("quick-jump-panel")).toBeNull();

    const fab = screen.getByRole("button", {
      name: /open quick jump panel/i,
    });
    await user.click(fab);

    expect(
      screen.getByRole("dialog", { name: "Quick jump" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Hide quick jump panel" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Quick jump" }),
      ).not.toBeInTheDocument();
    });
  });
});
import { vi } from "vitest";
