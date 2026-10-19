"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";

/**
 * Nina and her two things, loaded only for the page that shows them. Next.js
 * puts the not-found page of a segment into the payload of every page in it,
 * and an error page into the first JavaScript of every route, so both carry
 * only this reference instead of a whole figure. The server still draws the
 * picture for the page that needs it, and her place keeps its height until the
 * code arrives (`Screen`).
 */
export const DeferredFigure = lazyComponent(
  () => import("@/components/state/figure").then((module) => module.Figure),
  { loading: () => null }
);
