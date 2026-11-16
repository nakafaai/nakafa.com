import type { FigureAttrs } from "@nakafa/aksara-contracts/assessment/figure";
import { Option } from "effect";
import { createElement } from "react";
import { InlineContent } from "@/components/assessment/inline";
import { catalogRenderer } from "@/lib/content/renderer/catalog";
import { mapRichProps } from "@/lib/content/renderer/rich";

/**
 * The visual of one figure: its catalog renderer with each rich text of its props drawn as inline
 * content. A component the renderer does not register draws nothing; the manifest test proves that
 * every catalog figure has one. This module holds the whole renderer catalog, so it loads only when
 * a figure first shows (`AssessmentFigure`), never with the route that may show one.
 */
export function FigureVisual({ attrs }: { readonly attrs: FigureAttrs }) {
  const renderer = catalogRenderer(attrs.component);
  if (Option.isNone(renderer)) {
    return null;
  }
  const props = mapRichProps(attrs.props, (nodes) => (
    <InlineContent nodes={nodes} />
  ));
  return createElement(renderer.value.component, props);
}
