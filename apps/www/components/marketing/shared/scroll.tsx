"use client";

import { useLayoutEffect } from "react";

/**
 * Marks the document as showing a marketing page, so its pages scroll smoothly.
 * Next.js hides a page it navigates away from instead of unmounting it, and
 * React runs the cleanup of a layout effect when it hides a page. The mark
 * therefore leaves the document with the page, and a jump on any other page
 * stays instant.
 */
export function MarketingScroll() {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-smooth-scroll", "");
    return () => {
      document.documentElement.removeAttribute("data-smooth-scroll");
    };
  }, []);

  return null;
}
