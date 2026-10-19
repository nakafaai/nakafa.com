"use client";

import { Option } from "effect";
import { useEffect } from "react";

/** Decodes a fragment, or gives none when it holds a malformed escape such as a lone `%`. */
const decodeFragment = Option.liftThrowable(decodeURIComponent);

/**
 * Lands an address that names a part of the page, such as `#verse-200`, once
 * that part is in the page. The browser scrolls to the fragment while it reads
 * the document, but a part streamed in after that is placed by a script, and
 * the browser does not look again. So this runs when the part has mounted,
 * and only while the page still sits at its top, so a reader who has already
 * scrolled, or a browser that has already landed, is left where they are.
 * The part's own scroll margin keeps it clear of the headers. A fragment that
 * does not decode lands nowhere instead of breaking the page.
 */
export function FragmentLanding() {
  useEffect(() => {
    if (window.location.hash.length < 2 || window.scrollY !== 0) {
      return;
    }
    Option.map(decodeFragment(window.location.hash.slice(1)), (id) =>
      document.getElementById(id)?.scrollIntoView({ block: "start" })
    );
  }, []);

  return null;
}
