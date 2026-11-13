"use client";

import {
  DrawnBlockMath,
  DrawnInlineMath,
} from "@repo/design-system/components/markdown/drawn";
import { lazy } from "@repo/design-system/lib/lazy";
import { useHydrated } from "@tanstack/react-router";
import { Option } from "effect";
import { useState } from "react";
import { SETTLED_RENDERER } from "@/lib/static/settle";

/** KaTeX and the formula it draws, which a page's first load never asks for. */
const Drawing = lazy(() =>
  import("@/lib/content/renderer/client/base/katex").then((module) => ({
    default: module.KatexFormula,
  }))
);

/**
 * Draws one formula of a lesson from its TeX. The server draws it with KaTeX
 * into the page's HTML. A formula the browser hydrates keeps that markup: it
 * renders the same element with empty markup, which React never sets on an
 * element it hydrates, so the first load runs no KaTeX and the page's data holds
 * only the TeX. It keeps the markup only while its TeX is the one it hydrated
 * with: a client navigation to another lesson may hand the same component new
 * TeX, and it then draws that, as a formula that mounts on a navigation does,
 * with KaTeX, whose code the navigation loads before it shows the page
 * (`settle.ts`).
 */
function FormulaMarkup({
  display,
  errorColor,
  math,
}: {
  readonly display: boolean;
  readonly errorColor?: string | undefined;
  readonly math: string;
}) {
  const hydrated = useHydrated();
  // Read once, when the formula mounts: the TeX whose markup the server drew,
  // when the browser hydrates the formula.
  const [served] = useState(() =>
    !hydrated && typeof document !== "undefined"
      ? Option.some(math)
      : Option.none()
  );
  if (Option.contains(served, math)) {
    return display ? <DrawnBlockMath html="" /> : <DrawnInlineMath html="" />;
  }
  return <Drawing display={display} errorColor={errorColor} math={math} />;
}

export const FormulaDrawing = Object.assign(FormulaMarkup, {
  [SETTLED_RENDERER]: Drawing,
});
