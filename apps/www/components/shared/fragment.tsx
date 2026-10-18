"use client";

import { useEffect } from "react";

/**
 * Lands an address that names a part of the page, such as `#verse-200`, once
 * that part is in the page. The browser scrolls to the fragment while it reads
 * the document, but a part streamed in after that is placed by a script, and
 * the browser does not look again. So this runs when the part has mounted,
 * and only while the page still sits at its top, so a reader who has already
 * scrolled, or a browser that has already landed, is left where they are.
 * The part's own scroll margin keeps it clear of the headers.
 */
export function FragmentLanding() {
  useEffect(() => {
    if (window.location.hash.length < 2 || window.scrollY !== 0) {
      return;
    }
    document
      .getElementById(decodeURIComponent(window.location.hash.slice(1)))
      ?.scrollIntoView({ block: "start" });
  }, []);

  return null;
}
