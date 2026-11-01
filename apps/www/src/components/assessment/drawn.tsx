import { drawDocument } from "@repo/design-system/components/editor/prose";
import {
  blockGapVariants,
  pictureVariants,
} from "@repo/design-system/lib/prose";
import type { Node } from "@tiptap/pm/model";
import { cn } from "cn";
import { Array as Arr, MutableList, Option, Record as Rec } from "effect";
import { lazy, Suspense, use, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { SittingPictures } from "@/components/exams/sitting/pictures";

/** A figure's code is far too heavy for a paper that holds none, so it loads with the first figure. */
const LazyFigure = lazy(() =>
  import("@/components/assessment/figure").then((module) => ({
    default: module.DocumentFigure,
  }))
);

/** No figure to draw, one list for every text without one, so a text without a figure draws once. */
const NO_PLACES: readonly HTMLElement[] = [];

/** The places a drawn document keeps for its figures, in the order of the document. */
const figurePlaces = (root: HTMLElement): readonly HTMLElement[] => {
  const places = root.querySelectorAll<HTMLElement>(
    'figure[data-type="figure"]'
  );
  return places.length === 0 ? NO_PLACES : Arr.fromIterable(places);
};

/** The attributes of each figure of a document, in its order. */
const figuresOf = (doc: Node) => {
  const figures = MutableList.make<Node["attrs"]>();
  doc.descendants((node) => {
    if (node.type.name === "figure") {
      MutableList.append(figures, node.attrs);
    }
  });
  return MutableList.takeAll(figures);
};

/**
 * Draws each image of a drawn document as the editor's picture draws it: a box at the image's stored aspect
 * ratio, kept before the image loads, and the placeholder of that box until its address is resolved.
 */
function drawPictures(
  root: HTMLElement,
  urls: Readonly<Record<string, string>>
) {
  Arr.forEach(
    Arr.fromIterable(root.querySelectorAll<HTMLElement>('[data-type="image"]')),
    (element) => {
      const {
        alt = "",
        asset = "",
        height = "1",
        width = "1",
      } = element.dataset;
      element.className = cn(blockGapVariants(), "relative block max-w-full");
      element.style.aspectRatio = `${width} / ${height}`;
      element.style.maxWidth = `${width}px`;
      Option.match(Rec.get(urls, asset), {
        onNone: () => {
          const box = document.createElement("div");
          box.className = cn(pictureVariants(), "size-full");
          box.setAttribute("aria-label", alt);
          box.setAttribute("role", "img");
          element.replaceChildren(box);
        },
        onSome: (src) => {
          const picture = document.createElement("img");
          picture.alt = alt;
          picture.className = cn(pictureVariants(), "size-full object-contain");
          picture.height = Number(height);
          picture.src = src;
          picture.width = Number(width);
          element.replaceChildren(picture);
        },
      });
    }
  );
}

/**
 * The figures of a document drawn without an editor: each goes into the place `drawDocument` kept for it, drawn
 * by the component a try-out draws it with, as the student and the teacher both read it.
 */
function DrawnFigures({
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

/**
 * One assessment document drawn without an editor, once, in the same nodes for the student's paper and every page of
 * the teacher's canvas, with its images (`SittingPictures`) and its figures. A paper of forty questions costs a slow
 * phone a walk over each document, not an editor for each.
 */
export function DrawnDocument({
  className,
  doc,
  paragraphs,
}: {
  readonly className: string;
  readonly doc: Node;
  /** Whether its paragraphs take the article's classes, as a prompt does and an option does not. */
  readonly paragraphs: boolean;
}) {
  const urls = use(SittingPictures);
  const [figures, setFigures] = useState(NO_PLACES);
  const draw = useCallback(
    (element: HTMLDivElement | null) => {
      if (element !== null) {
        drawDocument(element, doc, paragraphs);
        drawPictures(element, urls);
        setFigures(figurePlaces(element));
      }
    },
    [doc, paragraphs, urls]
  );

  return (
    <>
      <div className={className} data-slot="sitting-document" ref={draw} />
      <DrawnFigures doc={doc} places={figures} />
    </>
  );
}
