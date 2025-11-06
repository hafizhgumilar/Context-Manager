"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
} from "react";
import {
  ArrowUpRight,
  Compass,
  Grip,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useBuilderStore } from "@/lib/store/builder-store";
import type { SectionType } from "@/lib/section-taxonomy";
import { useSectionObserver } from "@/hooks/use-section-observer";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { shallow } from "zustand/shallow";

type QuickJumpPanelProps = {
  scrollAreaRef: React.RefObject<HTMLDivElement>;
};

type QuickJumpSection = {
  id: string;
  title: string;
  type: SectionType;
};

const HIDE_DELAY = 600;
const HIGHLIGHT_DURATION = 800;

export function QuickJumpPanel({ scrollAreaRef }: QuickJumpPanelProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const sectionOrder = useBuilderStore(
    (state) => state.sectionOrder,
    shallow,
  );
  const sectionsById = useBuilderStore((state) => state.sectionsById);
  const reorderSections = useBuilderStore((state) => state.reorderSections);

  const sections = useMemo<QuickJumpSection[]>(() => {
    return sectionOrder
      .map((sectionId) => {
        const section = sectionsById[sectionId];
        if (!section) return null;
        return {
          id: section.id,
          title: section.title || "Untitled section",
          type: section.type,
        };
      })
      .filter((entry): entry is QuickJumpSection => entry !== null);
  }, [sectionOrder, sectionsById]);

  const [viewport, setViewport] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!scrollAreaRef.current) {
      setViewport(null);
      return;
    }
    const nextViewport = scrollAreaRef.current.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    setViewport(nextViewport ?? null);
  }, [scrollAreaRef]);

  const sectionIds = useMemo(
    () => sections.map((section) => section.id),
    [sections],
  );

  const { activeSectionId } = useSectionObserver(sectionIds, {
    root: viewport,
    rootMargin: "0px 0px -40% 0px",
    threshold: 0.5,
  });

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document
      .querySelectorAll<HTMLElement>("[data-builder-section-active='true']")
      .forEach((node) => node.removeAttribute("data-builder-section-active"));

    if (!activeSectionId) {
      return;
    }

    const activeElement = document.querySelector<HTMLElement>(
      `[data-builder-section-id="${activeSectionId}"]`,
    );
    activeElement?.setAttribute("data-builder-section-active", "true");

    return () => {
      const node = document.querySelector<HTMLElement>(
        `[data-builder-section-id="${activeSectionId}"]`,
      );
      node?.removeAttribute("data-builder-section-active");
    };
  }, [activeSectionId]);

  const [isOpen, setIsOpen] = useState(false);
  const [isHotZoneHovered, setIsHotZoneHovered] = useState(false);
  const [isPanelHovered, setIsPanelHovered] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const hideTimeoutRef = useRef<number | null>(null);
  const highlightTimeoutsRef = useRef<Map<string, number>>(new Map());
  const lastInteractionRef = useRef<number>(0);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const itemNodeMapRef = useRef<Record<string, HTMLDivElement | null>>({});
  const [dragDimensions, setDragDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const panelHoveredRef = useRef(false);
  const hotZoneHoveredRef = useRef(false);
  const searchFocusedRef = useRef(false);
  const [panelMetrics, setPanelMetrics] = useState(() => {
    const defaultTop = 112;
    if (typeof window === "undefined") {
      return { top: defaultTop, maxHeight: 560 };
    }
    const available = Math.max(320, window.innerHeight - defaultTop - 32);
    return { top: defaultTop, maxHeight: available };
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const updatePanelMetrics = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const headerRegion = document.querySelector<HTMLElement>(
      "[data-builder-header-region]",
    );
    const headerBottom = headerRegion?.getBoundingClientRect().bottom ?? 0;
    const offsetGap = 24;
    const top = Math.max(96, headerBottom + offsetGap);
    const maxHeight = Math.max(320, window.innerHeight - top - 32);
    setPanelMetrics((current) => {
      if (
        Math.abs(current.top - top) < 1 &&
        Math.abs(current.maxHeight - maxHeight) < 1
      ) {
        return current;
      }
      return { top, maxHeight };
    });
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }
    updatePanelMetrics();
    window.addEventListener("resize", updatePanelMetrics);
    return () => {
      window.removeEventListener("resize", updatePanelMetrics);
    };
  }, [isDesktop, updatePanelMetrics]);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }
    updatePanelMetrics();
  }, [isDesktop, sections.length, updatePanelMetrics]);

  useEffect(() => {
    if (!query) {
      setDebouncedQuery("");
      return;
    }
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim().toLowerCase());
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const filteredSections = useMemo(() => {
    if (!debouncedQuery) {
      return sections;
    }
    return sections.filter((section) => {
      const normalizedTitle = section.title.toLowerCase();
      return (
        normalizedTitle.includes(debouncedQuery) ||
        section.type.includes(debouncedQuery)
      );
    });
  }, [debouncedQuery, sections]);

  useEffect(() => {
    if (!debouncedQuery) {
      setAnnouncement("");
      return;
    }
    const label = filteredSections.length === 1 ? "section" : "sections";
    setAnnouncement(`${filteredSections.length} ${label} found`);
  }, [debouncedQuery, filteredSections.length]);

  const isReorderEnabled = debouncedQuery.length === 0 && sections.length > 1;

  const activeDragSection = useMemo(() => {
    if (!activeDragId) {
      return null;
    }
    return sections.find((section) => section.id === activeDragId) ?? null;
  }, [activeDragId, sections]);

  useEffect(() => {
    panelHoveredRef.current = isPanelHovered;
  }, [isPanelHovered]);

  useEffect(() => {
    hotZoneHoveredRef.current = isHotZoneHovered;
  }, [isHotZoneHovered]);

  useEffect(() => {
    searchFocusedRef.current = isSearchFocused;
  }, [isSearchFocused]);

  const registerInteraction = useCallback(() => {
    if (sections.length === 0) {
      return;
    }
    lastInteractionRef.current = performance.now();
    setIsOpen(true);
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, [sections.length]);

  const tryScheduleHide = useCallback(() => {
    if (!isOpen) {
      return;
    }
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = window.setTimeout(() => {
      const now = performance.now();
      const elapsed = now - lastInteractionRef.current;
      const hasFocusInside =
        panelRef.current &&
        panelRef.current.contains(document.activeElement);
      if (
        elapsed >= HIDE_DELAY &&
        !panelHoveredRef.current &&
        !hotZoneHoveredRef.current &&
        !searchFocusedRef.current &&
        !hasFocusInside
      ) {
        setIsOpen(false);
        hideTimeoutRef.current = null;
      } else {
        tryScheduleHide();
      }
    }, HIDE_DELAY);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      highlightTimeoutsRef.current.forEach((timeout) => {
        window.clearTimeout(timeout);
      });
      highlightTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      tryScheduleHide();
    } else if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, [isOpen, tryScheduleHide]);


  const panelNode = panelRef.current;
  useEffect(() => {
    if (!panelNode) {
      return;
    }
    const focusIn = () => registerInteraction();
    const focusOut = (event: FocusEvent) => {
      const related = event.relatedTarget as Node | null;
      if (panelNode && (!related || !panelNode.contains(related))) {
        tryScheduleHide();
      }
    };
    panelNode.addEventListener("focusin", focusIn);
    panelNode.addEventListener("focusout", focusOut);
    return () => {
      panelNode.removeEventListener("focusin", focusIn);
      panelNode.removeEventListener("focusout", focusOut);
    };
  }, [panelNode, registerInteraction, tryScheduleHide]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!sections.length) {
        return;
      }
      if (event.altKey && (event.code === "KeyJ" || event.key === "j" || event.key === "J")) {
        event.preventDefault();
        registerInteraction();
        setTimeout(() => {
          searchInputRef.current?.focus({ preventScroll: true });
        }, 0);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [registerInteraction, sections.length]);

  useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1);
      return;
    }
    if (!activeSectionId) {
      return;
    }
    const index = filteredSections.findIndex(
      (section) => section.id === activeSectionId,
    );
    if (index >= 0) {
      setFocusedIndex(index);
    }
  }, [activeSectionId, filteredSections, isOpen]);

  useEffect(() => {
    if (!isDesktop) {
      setIsHotZoneHovered(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (sections.length === 0) {
      setIsOpen(false);
    }
  }, [sections.length]);

  const highlightSection = useCallback((sectionId: string) => {
    if (typeof document === "undefined") {
      return;
    }
    const target = document.querySelector<HTMLElement>(
      `[data-builder-section-id="${sectionId}"]`,
    );
    if (!target) {
      return;
    }
    target.setAttribute("data-builder-section-highlighted", "true");
    const previous = highlightTimeoutsRef.current.get(sectionId);
    if (previous) {
      window.clearTimeout(previous);
    }
    const timeout = window.setTimeout(() => {
      target.removeAttribute("data-builder-section-highlighted");
      highlightTimeoutsRef.current.delete(sectionId);
    }, HIGHLIGHT_DURATION);
    highlightTimeoutsRef.current.set(sectionId, timeout);
  }, []);

  const scrollToSection = useCallback(
    (sectionId: string) => {
      const element = document.querySelector<HTMLElement>(
        `[data-builder-section-id="${sectionId}"]`,
      );
      if (!element) {
        return;
      }
      element.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
        inline: "nearest",
      });
      highlightSection(sectionId);
      registerInteraction();
      tryScheduleHide();
    },
    [highlightSection, prefersReducedMotion, registerInteraction, tryScheduleHide],
  );

  const handleSelect = useCallback(
    (sectionId: string) => {
      scrollToSection(sectionId);
    },
    [scrollToSection],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!isReorderEnabled) {
        return;
      }
      setActiveDragId(String(event.active.id));
      const node = itemNodeMapRef.current[String(event.active.id)];
      if (node) {
        const rect = node.getBoundingClientRect();
        setDragDimensions({ width: rect.width, height: rect.height });
      } else {
        setDragDimensions(null);
      }
      registerInteraction();
    },
    [isReorderEnabled, registerInteraction],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!isReorderEnabled) {
        setActiveDragId(null);
        setDragDimensions(null);
        return;
      }
      const { active, over } = event;
      if (over && active.id !== over.id) {
        reorderSections(String(active.id), String(over.id));
      }
      setActiveDragId(null);
      setDragDimensions(null);
    },
    [isReorderEnabled, reorderSections],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setDragDimensions(null);
  }, []);

  const handlePanelKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (filteredSections.length === 0) {
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const nextIndex =
          focusedIndex < filteredSections.length - 1 ? focusedIndex + 1 : 0;
        setFocusedIndex(nextIndex);
        const node = itemRefs.current[nextIndex];
        node?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const nextIndex =
          focusedIndex > 0 ? focusedIndex - 1 : filteredSections.length - 1;
        setFocusedIndex(nextIndex);
        const node = itemRefs.current[nextIndex];
        node?.focus();
      } else if (event.key === "Enter") {
        if (focusedIndex >= 0 && filteredSections[focusedIndex]) {
          event.preventDefault();
          handleSelect(filteredSections[focusedIndex].id);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      }
    },
    [filteredSections, focusedIndex, handleSelect],
  );

  const handleSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown" && filteredSections.length) {
        event.preventDefault();
        const node = itemRefs.current[0];
        if (node) {
          setFocusedIndex(0);
          node.focus();
        }
      }
    },
    [filteredSections.length],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    itemRefs.current = [];
  }, [isOpen, filteredSections]);

  const panelBody = (
    <div
      ref={panelRef}
      className="flex h-full w-full flex-1 flex-col gap-4 min-h-0"
      onPointerEnter={() => {
        setIsPanelHovered(true);
        panelHoveredRef.current = true;
        registerInteraction();
      }}
      onPointerLeave={() => {
        setIsPanelHovered(false);
        panelHoveredRef.current = false;
        tryScheduleHide();
      }}
      onKeyDown={handlePanelKeyDown}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          Quick jump
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
          onClick={() => {
            setIsOpen(false);
            if (hideTimeoutRef.current) {
              window.clearTimeout(hideTimeoutRef.current);
              hideTimeoutRef.current = null;
            }
          }}
          aria-label="Hide quick jump panel"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto py-1 pl-2 pr-6"
          style={{ scrollbarGutter: "stable" }}
          onScroll={registerInteraction}
        >
          <div className="sticky top-0 z-10 rounded-xl border border-border/60 bg-background/95 px-3 pb-3 pt-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/60"
                aria-hidden="true"
              />
              <Input
                ref={searchInputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  registerInteraction();
                }}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => {
                  setIsSearchFocused(true);
                  searchFocusedRef.current = true;
                  registerInteraction();
                }}
                onBlur={() => {
                  setIsSearchFocused(false);
                  searchFocusedRef.current = false;
                  tryScheduleHide();
                }}
                placeholder="Search sections..."
                className="h-9 rounded-xl border border-border/70 bg-background/75 pl-9 text-sm shadow-inner focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
                aria-label="Search sections"
              />
            </div>
            <div
              className="mt-2 text-xs text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {announcement}
            </div>
          </div>

          <div className="flex-1 pb-2">
            {filteredSections.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No sections match your filters.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext
                  items={filteredSections.map((section) => section.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-2">
                    {filteredSections.map((section, index) => (
                      <QuickJumpSortableItem
                        key={section.id}
                        section={section}
                        index={index}
                        isActive={section.id === activeSectionId}
                        isFocused={index === focusedIndex}
                        disabled={!isReorderEnabled}
                        onSelect={handleSelect}
                        onFocusIndex={(next) => setFocusedIndex(next)}
                        onPointerIndex={(next) => setFocusedIndex(next)}
                        itemRefs={itemRefs}
                        itemNodeMap={itemNodeMapRef}
                      />
                    ))}
                  </ul>
                </SortableContext>
                <DragOverlay dropAnimation={{ duration: 150, easing: "ease-out" }}>
                  {activeDragSection ? (
                    <QuickJumpOverlayItem
                      section={activeDragSection}
                      showCurrent={activeDragSection.id === activeSectionId}
                      dimensions={dragDimensions}
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span>Jump faster with</span>
        <kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          Alt + J
        </kbd>
      </div>
    </div>
  );

  const panelContainerClasses = cn(
    "fixed right-6 z-40 flex w-72 flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/95 p-4 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/90 transition-all",
    prefersReducedMotion ? "transition-none" : "duration-200 ease-out",
    isOpen
      ? "pointer-events-auto opacity-100 translate-x-0"
      : "pointer-events-none opacity-0 translate-x-6",
  );

  const panelStyle = useMemo(
    () => ({
      top: panelMetrics.top,
      maxHeight: panelMetrics.maxHeight,
    }),
    [panelMetrics],
  );

  const hotZoneStyle = useMemo(
    () => ({
      top: Math.max(48, panelMetrics.top - 24),
      bottom: 24,
    }),
    [panelMetrics],
  );

  return (
    <Fragment>
      {isDesktop && sections.length > 0 && (
        <Fragment>
          <div
            data-testid="quick-jump-hotzone"
            className="fixed right-0 z-30 w-6 cursor-pointer"
            style={hotZoneStyle}
            onPointerEnter={() => {
              setIsHotZoneHovered(true);
              hotZoneHoveredRef.current = true;
              registerInteraction();
            }}
            onPointerLeave={() => {
              setIsHotZoneHovered(false);
              hotZoneHoveredRef.current = false;
              tryScheduleHide();
            }}
            aria-hidden="true"
          />
          <div
            data-testid="quick-jump-panel"
            className={panelContainerClasses}
            style={panelStyle}
          >
            {panelBody}
          </div>
        </Fragment>
      )}

      {!isDesktop && sections.length > 0 && (
        <Fragment>
          <Button
            type="button"
            className={cn(
              "fixed bottom-24 right-6 z-40 h-12 w-12 rounded-full shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isOpen
                ? "bg-primary text-primary-foreground"
                : "bg-gradient-to-br from-primary/95 to-primary/80 text-white",
            )}
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
                if (hideTimeoutRef.current) {
                  window.clearTimeout(hideTimeoutRef.current);
                  hideTimeoutRef.current = null;
                }
              } else {
                registerInteraction();
                if (sections.length > 0) {
                  setTimeout(() => {
                    searchInputRef.current?.focus({ preventScroll: true });
                  }, 0);
                }
              }
            }}
            aria-label={isOpen ? "Close quick jump panel" : "Open quick jump panel"}
          >
            <Compass className="h-5 w-5" aria-hidden="true" />
          </Button>
          <Sheet
            open={isOpen}
            onOpenChange={(next) => {
              setIsOpen(next);
              if (!next && hideTimeoutRef.current) {
                window.clearTimeout(hideTimeoutRef.current);
                hideTimeoutRef.current = null;
              }
            }}
          >
            <SheetContent
              side="bottom"
              aria-label="Quick jump"
              className="h-[60vh] overflow-hidden rounded-t-3xl border-t border-border/70 bg-background/95 backdrop-blur"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Quick jump</SheetTitle>
                <SheetDescription>
                  Browse prompt sections and jump directly to them.
                </SheetDescription>
              </SheetHeader>
              <div className="h-full overflow-hidden pt-2">
                {panelBody}
              </div>
            </SheetContent>
          </Sheet>
        </Fragment>
      )}
    </Fragment>
  );
}

type QuickJumpSortableItemProps = {
  section: QuickJumpSection;
  index: number;
  isActive: boolean;
  isFocused: boolean;
  disabled: boolean;
  onSelect: (sectionId: string) => void;
  onFocusIndex: (index: number) => void;
  onPointerIndex: (index: number) => void;
  itemRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  itemNodeMap: MutableRefObject<Record<string, HTMLDivElement | null>>;
};

function QuickJumpSortableItem({
  section,
  index,
  isActive,
  isFocused,
  disabled,
  onSelect,
  onFocusIndex,
  onPointerIndex,
  itemRefs,
  itemNodeMap,
}: QuickJumpSortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: section.id,
      disabled,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSelect = useCallback(() => {
    if (isDragging) {
      return;
    }
    onSelect(section.id);
  }, [isDragging, onSelect, section.id]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!isDragging) {
          onSelect(section.id);
        }
      }
    },
    [isDragging, onSelect, section.id],
  );

  const { tabIndex: attrTabIndex, ...restAttributes } = attributes ?? {};
  const handleTabIndex = disabled ? -1 : attrTabIndex ?? 0;
  const handleListeners = disabled ? undefined : listeners;

  return (
    <li
      className={cn("relative", isDragging && "z-50")}
    >
      <div
        ref={(node) => {
          setNodeRef(node);
          itemRefs.current[index] = node;
          if (node) {
            itemNodeMap.current[section.id] = node;
          } else {
            delete itemNodeMap.current[section.id];
          }
        }}
        style={style}
        role="button"
        tabIndex={0}
        aria-pressed={isActive}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        onFocus={() => onFocusIndex(index)}
        onPointerMove={() => {
          if (!isDragging) {
            onPointerIndex(index);
          }
        }}
        onMouseEnter={() => {
          if (!isDragging) {
            onPointerIndex(index);
          }
        }}
        className={cn(
          "group flex w-full items-center gap-3 rounded-xl border border-transparent bg-background/60 px-3 py-2 text-left text-sm shadow-sm transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isActive && "border-primary/60 bg-primary/10 text-primary shadow-md",
          isFocused && "ring-2 ring-primary/70 ring-offset-1",
          isDragging && "opacity-90",
        )}
        data-current={isActive ? "true" : undefined}
      >
        <button
          type="button"
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/85 text-muted-foreground transition",
            disabled
              ? "cursor-default opacity-50"
              : "cursor-grab hover:border-primary/40 hover:text-primary active:cursor-grabbing",
          )}
          aria-label="Drag to reorder"
          disabled={disabled}
          tabIndex={handleTabIndex}
          onClick={(event) => event.stopPropagation()}
          {...(handleListeners ?? {})}
          {...(disabled ? {} : restAttributes)}
        >
          <Grip className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <div className="flex flex-1 flex-col">
          <span className="font-medium leading-5">{section.title}</span>
          <span className="text-[11px] uppercase text-muted-foreground">
            {section.type.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <Badge
              variant="outline"
              className="text-[10px] uppercase text-primary"
            >
              Current
            </Badge>
          )}
          <ArrowUpRight
            className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 group-hover:translate-x-1 group-hover:text-primary"
            aria-hidden="true"
          />
        </div>
      </div>
    </li>
  );
}

type QuickJumpOverlayItemProps = {
  section: QuickJumpSection;
  showCurrent: boolean;
  dimensions: { width: number; height: number } | null;
};

function QuickJumpOverlayItem({
  section,
  showCurrent,
  dimensions,
}: QuickJumpOverlayItemProps) {
  return (
    <div
      className="pointer-events-none"
      style={
        dimensions
          ? { width: `${dimensions.width}px`, height: `${dimensions.height}px` }
          : undefined
      }
    >
      <div
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background/95 px-3 py-2 text-sm shadow-lg backdrop-blur",
          showCurrent && "border-primary/60 bg-primary/10 text-primary",
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/85 text-muted-foreground/70">
          <Grip className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
        <div className="flex flex-1 flex-col">
          <span className="font-medium leading-5">{section.title}</span>
          <span className="text-[11px] uppercase text-muted-foreground">
            {section.type.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showCurrent && (
            <Badge
              variant="outline"
              className="text-[10px] uppercase text-primary"
            >
              Current
            </Badge>
          )}
          <ArrowUpRight
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
