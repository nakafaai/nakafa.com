import type { Node } from "@tiptap/pm/model";
import { Array as Arr } from "effect";
import { lazy, Suspense } from "react";
import { createPortal } from "react-dom";

/** A figure's code is far too heavy for a paper that holds none, so it loads with the first figure. */
const LazyFigure = lazy(() =>
  import("@/components/assessment/figure").then((module) => ({
    default: module.DocumentFigure,
  }))
);

/** No figure to draw, one list for every text without one, so a text without a figure draws once. */
const NO_PLACES: readonly HTMLElement[] = [];

/** The places a drawn document keeps for its figures, in the order of the document. */
export const figurePlaces = (root: HTMLElement): readonly HTMLElement[] => {
  const places = root.querySelectorAll<HTMLElement>(
    'figure[data-type="figure"]'
  );
  return places.length === 0 ? NO_PLACES : Arr.fromIterable(places);
};

/** The attributes of each figure of a document, in its order. */
const figuresOf = (doc: Node) => {
  const figures: Node["attrs"][] = [];
  doc.descendants((node) => {
    if (node.type.name === "figure") {
      figures.push(node.attrs);
    }
  });
  return figures;
};

/**
 * The figures of a document drawn without an editor: each goes into the place `drawDocument` kept for it, drawn
 * by the component a try-out draws it with, as the student and the teacher both read it.
 */
export function DrawnFigures({
  doc,
  places,
}: {
  readonly doc: Node;
  readonly places: readonly HTMLElement[];
}) {
  const figures = figuresOf(doc);

  return Arr.map(places, (place, index) =>
    createPortal(
      <Suspense fallback={null}>
        <LazyFigure attrs={figures[index]} />
      </Suspense>,
      place
    )
  );
}
