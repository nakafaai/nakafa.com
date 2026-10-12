import { Drawing } from "@repo/design-system/components/ui/drawing";
import type { Mark } from "@repo/mascot/nina/mark";
import type { Shape } from "@repo/mascot/shape";
import { Array as Arr, Match } from "effect";
import { createElement, Fragment, type ReactElement, type Ref } from "react";

interface PictureProps {
  /** The window on her: where it starts, and how wide and high it is. */
  box: readonly [number, number, number, number];
  /** What a screen reader says. Empty when she only decorates what is already said. */
  label: string;
  /** Lets her life reach the svg element and move what is drawn in it. */
  ref?: Ref<SVGSVGElement>;
  /** What she is drawn from, in the order it is drawn. */
  shapes: readonly Shape<Mark>[];
  /** Her width in pixels. */
  size: number;
}

/** A `data-` attribute, which names an element for her life and for a test. */
function data(name: `data-${string}`, value: string) {
  return { [name]: value };
}

/** What a mark says about an element: a limb, a layer of her figure, or an open eye. */
function marked(mark: Mark) {
  return Match.valueTags(mark, {
    eye: () => data("data-eye", "true"),
    limb: ({ name }) => data("data-limb", name),
    part: ({ name }) => data("data-part", name),
  });
}

/**
 * Draws a list of shapes one after the other. Each is passed as an argument of
 * its own, because her picture has the same shapes in the same places every
 * time it is drawn, so no shape needs a key.
 */
function Shapes({ shapes }: { shapes: readonly Shape<Mark>[] }): ReactElement {
  return createElement(
    Fragment,
    null,
    ...Arr.map(shapes, (shape) =>
      createElement(Drawing<Mark>, { marked, shape })
    )
  );
}

/** Nina as a picture: an SVG of flat shapes, in the window that her scene asks for. */
export function Picture({ box, label, ref, shapes, size }: PictureProps) {
  const named = label !== "";
  return (
    <svg
      aria-hidden={named ? undefined : true}
      aria-label={named ? label : undefined}
      className="block shrink-0"
      height={Math.round((size * box[3]) / box[2])}
      ref={ref}
      role={named ? "img" : undefined}
      viewBox={`${box[0]} ${box[1]} ${box[2]} ${box[3]}`}
      width={size}
    >
      <Shapes shapes={shapes} />
    </svg>
  );
}
