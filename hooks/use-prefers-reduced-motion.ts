"use client";

import { useEffect, useState } from "react";

/**
 * Returns whether the user has requested reduced motion via the OS setting.
 * Falls back to `false` when matchMedia is unavailable (e.g. during SSR).
 */
export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updatePreference = (event: MediaQueryListEvent | MediaQueryList) => {
      setPrefersReducedMotion(event.matches);
    };

    updatePreference(mediaQuery);

    const listener = (event: MediaQueryListEvent) => updatePreference(event);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(listener);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", listener);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(listener);
      }
    };
  }, []);

  return prefersReducedMotion;
}

