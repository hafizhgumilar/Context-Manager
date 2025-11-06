"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { TemplateCategory } from "@/lib/section-taxonomy";
import { SectionLibrary } from "@/components/builder/section-library";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

const SIDEBAR_STATE_KEY = "sectionsSidebarState";
const SIDEBAR_WIDTH_KEY = "sectionsSidebarWidth";
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 248;
const MAX_WIDTH = 420;
const COLLAPSED_WIDTH = 56;
const HANDLE_WIDTH = 20;
const TRANSITION = "width 220ms cubic-bezier(0.22, 1, 0.36, 1)";

type SectionsSidebarProps = {
  activeCategory: TemplateCategory;
  onCategoryChange: (category: TemplateCategory) => void;
  onAddSection: () => void;
  className?: string;
};

function clampWidth(value: number) {
  return Math.min(Math.max(value, MIN_WIDTH), MAX_WIDTH);
}

export function SectionsSidebar({
  activeCategory,
  onCategoryChange,
  onAddSection,
  className,
}: SectionsSidebarProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isExpanded, setIsExpanded] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(DEFAULT_WIDTH);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedState = window.localStorage.getItem(SIDEBAR_STATE_KEY);
    if (storedState === "collapsed") {
      setIsExpanded(false);
    }

    const storedWidth = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (storedWidth) {
      const parsed = Number.parseInt(storedWidth, 10);
      if (!Number.isNaN(parsed)) {
        setSidebarWidth(clampWidth(parsed));
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      SIDEBAR_STATE_KEY,
      isExpanded ? "expanded" : "collapsed",
    );
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      SIDEBAR_WIDTH_KEY,
      String(Math.round(sidebarWidth)),
    );
  }, [isExpanded, sidebarWidth]);

  useEffect(() => {
    if (!contentRef.current) {
      return;
    }

    const element = contentRef.current as HTMLElement & { inert?: boolean };
    if (isExpanded) {
      element.removeAttribute("aria-hidden");
      if (typeof element.inert !== "undefined") {
        element.inert = false;
      }
    } else {
      element.setAttribute("aria-hidden", "true");
      if (typeof element.inert !== "undefined") {
        element.inert = true;
      }
    }
  }, [isExpanded]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) {
        return;
      }
      if (event.code === "Backslash") {
        event.preventDefault();
        setIsExpanded((previous) => !previous);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isResizing) {
      document.body.style.cursor = "";
      return;
    }

    document.body.style.cursor = "col-resize";

    const handlePointerMove = (event: PointerEvent) => {
      const delta = event.clientX - resizeStartX.current;
      const nextWidth = clampWidth(resizeStartWidth.current + delta);
      setSidebarWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
    };
  }, [isResizing]);

  const handleToggle = useCallback(() => {
    setIsExpanded((previous) => !previous);
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isExpanded) {
        return;
      }
      event.preventDefault();
      resizeStartX.current = event.clientX;
      resizeStartWidth.current = sidebarWidth;
      setIsResizing(true);
    },
    [isExpanded, sidebarWidth],
  );

  const sidebarStyle = useMemo<CSSProperties>(
    () => ({
      width: isExpanded ? sidebarWidth : COLLAPSED_WIDTH,
      transition:
        prefersReducedMotion || isResizing ? undefined : TRANSITION,
    }),
    [isExpanded, sidebarWidth, prefersReducedMotion, isResizing],
  );

  const contentStyle = useMemo<CSSProperties>(
    () => ({
      width: Math.max(
        isExpanded ? sidebarWidth - HANDLE_WIDTH : 0,
        0,
      ),
      transition:
        prefersReducedMotion || isResizing ? undefined : TRANSITION,
    }),
    [isExpanded, sidebarWidth, prefersReducedMotion, isResizing],
  );

  const toggleLabel = isExpanded
    ? "Collapse sections sidebar (Alt+\\)"
    : "Expand sections sidebar (Alt+\\)";

  return (
    <aside
      className={cn(
        "group/sidebar relative flex h-full shrink-0 items-stretch",
        className,
      )}
      style={sidebarStyle}
    >
      <div
        ref={contentRef}
        id="builder-sections-sidebar"
        className={cn(
          "flex h-full flex-1 origin-left overflow-hidden rounded-2xl border border-border bg-card/70 shadow-sm backdrop-blur transition-[opacity,transform]",
          !isExpanded &&
            "pointer-events-none opacity-0 [transform:translateX(-12px)]",
        )}
        style={contentStyle}
      >
        <ScrollArea className="h-full w-full">
          <div className="pb-6 pr-4">
            <SectionLibrary
              activeCategory={activeCategory}
              onCategoryChange={onCategoryChange}
              onAddSection={onAddSection}
            />
          </div>
        </ScrollArea>
      </div>
      <div
        className={cn(
          "relative flex h-full w-[56px] shrink-0 items-center justify-center",
          "after:absolute after:inset-y-4 after:left-0 after:w-px after:bg-border/60",
        )}
      >
        <button
          type="button"
          onClick={handleToggle}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full border border-border/70 bg-gradient-to-br from-background/95 to-background/65 text-muted-foreground shadow-lg transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "hover:border-primary/40 hover:text-primary",
          )}
          aria-label={toggleLabel}
          aria-controls="builder-sections-sidebar"
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-hidden="true"
          className={cn(
            "absolute right-0 top-0 h-full w-3 cursor-col-resize px-1",
            !isExpanded && "hidden",
          )}
          onPointerDown={handlePointerDown}
        />
      </div>
    </aside>
  );
}
