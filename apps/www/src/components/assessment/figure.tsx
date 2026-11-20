"use client";

import type { FigureAttrs } from "@nakafa/aksara-contracts/assessment/figure";
import { FigureAttrsSchema } from "@nakafa/aksara-contracts/assessment/figure";
import { lazy } from "@repo/design-system/lib/lazy";
import { Option, Schema } from "effect";
import { Suspense } from "react";
import { InlineContent } from "@/components/assessment/inline";

/**
 * The renderer catalog and the figure drawn with it. The catalog names every visual a lesson can
 * draw, so it loads when a figure first shows, never with the route that may show one: a try-out
 * page carried all of it in its first JavaScript.
 */
const FigureVisual = lazy(() =>
  import("@/components/assessment/visual").then((module) => ({
    default: module.FigureVisual,
  }))
);

/**
 * One figure of an assessment document: the catalog component it names, drawn by the renderer a
 * lesson draws it with, under the figure's text alternative and over its caption. The catalog and
 * the component's code load when the first figure of its kind shows, as a lesson's does; until then
 * the boundary keeps the server's drawing, or nothing on a move to the page, and the caption stays.
 */
export function AssessmentFigure({ attrs }: { readonly attrs: FigureAttrs }) {
  return (
    <figure aria-label={attrs.alt} className="grid gap-2">
      <Suspense fallback={null}>
        <FigureVisual attrs={attrs} />
      </Suspense>
      {attrs.caption === null ? null : (
        <figcaption className="text-muted-foreground text-sm">
          <InlineContent nodes={attrs.caption} />
        </figcaption>
      )}
    </figure>
  );
}

/** A figure read from the attributes of a document's node. What the contract refuses draws nothing. */
export function DocumentFigure({ attrs }: { readonly attrs: unknown }) {
  const figure = Schema.decodeUnknownOption(FigureAttrsSchema)(attrs);
  if (Option.isNone(figure)) {
    return null;
  }
  return <AssessmentFigure attrs={figure.value} />;
}
