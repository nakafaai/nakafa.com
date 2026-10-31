import { editorDocument } from "@repo/design-system/components/editor/frame";
import { drawDocument } from "@repo/design-system/components/editor/prose";
import {
  blockGapVariants,
  pictureVariants,
} from "@repo/design-system/lib/prose";
import { Node } from "@tiptap/pm/model";
import { cn } from "cn";
import { Array as Arr, Option, Record as Rec } from "effect";
import { use, useCallback, useMemo } from "react";
import { SittingPictures } from "@/components/exams/sitting/pictures";
import { assessmentSchema } from "@/lib/editor/assessment";

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
 * One assessment document, read-only, as the exam canvas and the published article read it. It is drawn once
 * without an editor (`drawDocument`), so a paper of forty questions with their options costs a slow phone a
 * walk over each document, not an editor for each. The document is the JSON object of a prompt or of an option
 * label: a prompt reads as a page, with the article's paragraphs, and an option as one line.
 */
export function SittingReader({
  document,
  size = "page",
}: {
  readonly document: unknown;
  /** How the text reads: a prompt as a page, and an option as one line. */
  readonly size?: "line" | "page";
}) {
  const urls = use(SittingPictures);
  const content = useMemo(
    () => Node.fromJSON(assessmentSchema, document),
    [document]
  );
  const draw = useCallback(
    (element: HTMLDivElement | null) => {
      if (element !== null) {
        drawDocument(element, content, size === "page");
        drawPictures(element, urls);
      }
    },
    [content, size, urls]
  );

  return (
    <div
      className={cn(editorDocument({ size, text: "article" }), "min-h-0")}
      data-slot="sitting-document"
      ref={draw}
    />
  );
}
