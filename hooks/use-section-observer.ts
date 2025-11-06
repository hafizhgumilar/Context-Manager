"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type UseSectionObserverOptions = {
  root?: HTMLElement | null;
  rootMargin?: string;
  threshold?: number;
};

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

/**
 * Observes the rendered section cards and derives visibility + active state.
 * Internally relies on IntersectionObserver and defaults to the UX-friendly
 * configuration defined in the product spec.
 */
export function useSectionObserver(
  sectionIds: string[],
  options: UseSectionObserverOptions = {},
) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [visibleSectionIds, setVisibleSectionIds] = useState<string[]>([]);
  const [visitedCount, setVisitedCount] = useState(0);

  const visibilityRef = useRef<Map<string, IntersectionObserverEntry>>(new Map());
  const visitedRef = useRef<Set<string>>(new Set());
  const activeRef = useRef<string | null>(null);
  const prevVisibleRef = useRef<string[]>([]);
  const visitedCountRef = useRef(0);

  const { root, rootMargin, threshold } = useMemo(
    () => ({
      root: options.root ?? null,
      rootMargin: options.rootMargin ?? "0px 0px -40% 0px",
      threshold: options.threshold ?? 0.5,
    }),
    [options.root, options.rootMargin, options.threshold],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    visibilityRef.current.clear();

    const elements = sectionIds
      .map((id) =>
        document.querySelector<HTMLElement>(
          `[data-builder-section-id="${id}"]`,
        ),
      )
      .filter((element): element is HTMLElement => Boolean(element));

    if (elements.length === 0) {
      setVisibleSectionIds([]);
      setActiveSectionId(null);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let visitedDirty = false;

        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;
          const sectionId = element.dataset.builderSectionId;
          if (!sectionId) {
            return;
          }
          if (entry.isIntersecting) {
            visibilityRef.current.set(sectionId, entry);
            if (!visitedRef.current.has(sectionId)) {
              visitedRef.current.add(sectionId);
              visitedDirty = true;
            }
          } else {
            visibilityRef.current.delete(sectionId);
          }
        });

        if (visitedDirty && visitedRef.current.size !== visitedCountRef.current) {
          visitedCountRef.current = visitedRef.current.size;
          setVisitedCount(visitedRef.current.size);
        }

        const visibleByOrder = sectionIds.filter((id) =>
          visibilityRef.current.has(id),
        );

        if (!arraysEqual(prevVisibleRef.current, visibleByOrder)) {
          prevVisibleRef.current = visibleByOrder;
          setVisibleSectionIds(visibleByOrder);
        }

        let nextActiveId: string | null = activeRef.current;

        if (visibleByOrder.length > 0) {
          let bestId: string | null = null;
          let bestRatio = -1;
          let bestTop = Number.POSITIVE_INFINITY;

          visibleByOrder.forEach((id) => {
            const entry = visibilityRef.current.get(id);
            if (!entry) {
              return;
            }
            const ratio = entry.intersectionRatio;
            const top = entry.boundingClientRect.top;
            if (
              ratio > bestRatio ||
              (ratio === bestRatio && top < bestTop)
            ) {
              bestId = id;
              bestRatio = ratio;
              bestTop = top;
            }
          });

          nextActiveId = bestId ?? visibleByOrder[0] ?? null;
        }

        if (nextActiveId !== activeRef.current) {
          activeRef.current = nextActiveId;
          setActiveSectionId(activeRef.current);
        }
      },
      {
        root: root ?? undefined,
        rootMargin,
        threshold,
      },
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, [root, rootMargin, sectionIds, threshold]);

  useEffect(() => {
    if (sectionIds.length === 0) {
      visitedRef.current.clear();
      visibilityRef.current.clear();
      prevVisibleRef.current = [];
      visitedCountRef.current = 0;
      setVisitedCount(0);
      setVisibleSectionIds([]);
      setActiveSectionId(null);
    }
  }, [sectionIds]);

  return {
    activeSectionId,
    visibleSectionIds,
    visitedCount,
  };
}
