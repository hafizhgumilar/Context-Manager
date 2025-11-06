"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  useBuilderStore,
  type BuilderSection,
} from "@/lib/store/builder-store";
import {
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
  type SectionType,
} from "@/lib/section-taxonomy";
import { BuilderHeader } from "@/components/builder/builder-header";
import { SectionCanvas } from "@/components/builder/section-canvas";
import { AddSectionSheet } from "@/components/builder/add-section-sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppTopbar } from "@/components/navigation/app-topbar";
import { SectionsSidebar } from "@/components/builder/sections-sidebar";
import { SectionLibrary } from "@/components/builder/section-library";
import { QuickJumpPanel } from "@/components/builder/quick-jump-panel";

type InitialTemplateSection = {
  id: string;
  type: string;
  title: string;
  orderIndex: number;
  filename: string | null;
  content: string;
};

type InitialTemplateData = {
  id: string;
  name: string;
  category: string;
  sections: InitialTemplateSection[];
};

type InitialTemplate = InitialTemplateData | null;

type BuilderShellProps = {
  initialTemplate?: InitialTemplate;
};

type InitialTemplateSections = InitialTemplateSection[];

function toBuilderSections(
  sections: InitialTemplateSections | undefined | null,
): BuilderSection[] {
  if (!sections || sections.length === 0) {
    return [];
  }
  return sections
    .slice()
    .sort(
      (a: InitialTemplateSection, b: InitialTemplateSection) =>
        a.orderIndex - b.orderIndex,
    )
    .map((section: InitialTemplateSection) => ({
      id: section.id,
      type: section.type as SectionType,
      title: section.title,
      content: section.content,
      filename: section.filename ?? undefined,
      orderIndex: section.orderIndex,
    }));
}

export function BuilderShell({ initialTemplate = null }: BuilderShellProps) {
  const category = useBuilderStore((state) => state.category);
  const setCategory = useBuilderStore((state) => state.setCategory);
  const hydrateFromTemplate = useBuilderStore(
    (state) => state.hydrateFromTemplate,
  );
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const [sidebarMetrics, setSidebarMetrics] = useState(() => ({
    top: 112,
    height: typeof window === "undefined" ? 640 : window.innerHeight - 144,
  }));

  const availableCategories = useMemo(
    () => TEMPLATE_CATEGORIES.map((item) => item.id),
    [],
  );

  useEffect(() => {
    if (!initialTemplate) return;

    const templateCategory = TEMPLATE_CATEGORIES.some(
      (item) => item.id === initialTemplate.category,
    )
      ? (initialTemplate.category as TemplateCategory)
      : "basic";

    hydrateFromTemplate({
      id: initialTemplate.id,
      name: initialTemplate.name,
      category: templateCategory,
      sections: toBuilderSections(initialTemplate.sections),
    });
  }, [hydrateFromTemplate, initialTemplate]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateSidebarMetrics = () => {
      const headerRegion = document.querySelector<HTMLElement>(
        "[data-builder-header-region]",
      );
      const headerBottom = headerRegion?.getBoundingClientRect().bottom ?? 0;
      const top = Math.max(96, headerBottom + 24);
      const viewportHeight = window.innerHeight;
      const height = Math.max(360, viewportHeight - top - 32);
      setSidebarMetrics({ top, height });
    };

    updateSidebarMetrics();
    window.addEventListener("resize", updateSidebarMetrics);
    return () => window.removeEventListener("resize", updateSidebarMetrics);
  }, []);

  const floatingSidebarStyle = useMemo<CSSProperties>(
    () => ({
      position: "fixed",
      top: `${sidebarMetrics.top}px`,
      left: "clamp(24px, 4vw, 72px)",
      height: `${sidebarMetrics.height}px`,
      display: "flex",
      alignItems: "stretch",
      zIndex: 45,
    }),
    [sidebarMetrics.height, sidebarMetrics.top],
  );

  return (
    <div className="flex min-h-screen lg:h-screen flex-col bg-muted/10">
      <div
        data-builder-header-region
        className="sticky top-0 z-50 flex flex-col bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70"
      >
        <AppTopbar />
        <BuilderHeader />
      </div>
      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="relative flex w-full flex-1 flex-col gap-6 overflow-hidden px-4 py-6 lg:px-8 xl:px-12 2xl:px-16 min-h-0">
          <div className="lg:hidden">
            <ScrollArea className="max-h-[420px] w-full rounded-2xl border border-border bg-card/70 shadow-sm">
              <div className="pb-6 pr-4">
                <SectionLibrary
                  activeCategory={category}
                  onCategoryChange={(next) => {
                    if (availableCategories.includes(next)) {
                      setCategory(next);
                    }
                  }}
                  onAddSection={() => setQuickAddOpen(true)}
                />
              </div>
            </ScrollArea>
          </div>
          <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden lg:pl-[clamp(5rem,6vw,7.5rem)]">
            <div className="flex-1 min-h-0">
              <ScrollArea ref={canvasScrollRef} className="h-full">
                <div className="pr-1 pb-6">
                  <SectionCanvas />
                </div>
              </ScrollArea>
            </div>
            <div className="shrink-0 border-t border-dashed border-border pt-4">
              <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                <p className="text-sm text-muted-foreground">
                  Drag cards to reorder. Add more sections anytime.
                </p>
                <Button onClick={() => setQuickAddOpen(true)}>
                  Add section
                </Button>
              </div>
              <AddSectionSheet
                open={quickAddOpen}
                onOpenChange={setQuickAddOpen}
              />
            </div>
          </main>
          <QuickJumpPanel scrollAreaRef={canvasScrollRef} />
        </div>
      </div>
      <div
        className="hidden lg:flex"
        style={floatingSidebarStyle}
      >
        <SectionsSidebar
          activeCategory={category}
          onCategoryChange={(next) => {
            if (availableCategories.includes(next)) {
              setCategory(next);
            }
          }}
          onAddSection={() => setQuickAddOpen(true)}
          className="flex h-full min-h-0 rounded-2xl border border-border/70 bg-background/95 shadow-[0_18px_48px_rgba(15,23,42,0.18)] backdrop-blur"
        />
      </div>
    </div>
  );
}
