"use client";

import { useEffect, useState } from "react";

/**
 * Tracks whether the given CSS media query currently matches.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const updateMatch = () => setMatches(mediaQuery.matches);

    updateMatch();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateMatch);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(updateMatch);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", updateMatch);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(updateMatch);
      }
    };
  }, [query]);

  return matches;
}

