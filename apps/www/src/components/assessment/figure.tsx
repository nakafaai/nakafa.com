"use client";

import {
  type FigureAttrs,
  FigureAttrsSchema,
} from "@nakafa/aksara-contracts/assessment/figure";
import { Option, Schema } from "effect";
import { createElement } from "react";
import { InlineContent } from "@/components/assessment/inline";
import { catalogRenderer } from "@/lib/content/renderer/catalog";
import { mapRichProps } from "@/lib/content/renderer/rich";

/**
 * One figure of an assessment document: the catalog component it names, drawn by the renderer a
 * lesson draws it with, under the figure's text alternative and over its caption. The component's
 * code loads when the first figure of its kind shows, as a lesson's does.
 */
export function AssessmentFigure({ attrs }: { readonly attrs: FigureAttrs }) {
  return (
    <figure aria-label={attrs.alt} className="grid gap-2">
      <FigureVisual attrs={attrs} />
      {attrs.caption === null ? null : (
        <figcaption className="text-muted-foreground text-sm">
          <InlineContent nodes={attrs.caption} />
        </figcaption>
      )}
    </figure>
  );
}

/**
 * The visual of one figure: its catalog renderer with each rich text of its props drawn as inline
 * content. A component the renderer does not register draws nothing; the manifest test proves that
 * every catalog figure has one.
 */
function FigureVisual({ attrs }: { readonly attrs: FigureAttrs }) {
  const renderer = catalogRenderer(attrs.component);
  if (Option.isNone(renderer)) {
    return null;
  }
  const props = mapRichProps(attrs.props, (nodes) => (
    <InlineContent nodes={nodes} />
  ));
  return createElement(renderer.value.component, props);
}

/** A figure read from the attributes of a document's node. What the contract refuses draws nothing. */
export function DocumentFigure({ attrs }: { readonly attrs: unknown }) {
  const figure = Schema.decodeUnknownOption(FigureAttrsSchema)(attrs);
  if (Option.isNone(figure)) {
    return null;
  }
  return <AssessmentFigure attrs={figure.value} />;
}
