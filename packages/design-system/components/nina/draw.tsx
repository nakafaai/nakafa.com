import type { scene } from "@repo/design-system/components/nina/figure";
import type { Shape } from "@repo/design-system/components/nina/shape";
import { Array as Arr, Match } from "effect";
import { createElement, Fragment, type ReactElement } from "react";

type PictureProps = ReturnType<typeof scene> & {
  /** What a screen reader says. Empty when she only decorates what is already said. */
  label: string;
  /** Her width in pixels. */
  size: number;
};

/**
 * Draws a list of shapes one after the other. Each child is passed as an
 * argument of its own, because the picture has the same shapes in the same
 * places every time it is drawn, so no shape needs a key.
 */
function Shapes({ shapes }: { shapes: readonly Shape[] }): ReactElement {
  return createElement(
    Fragment,
    null,
    ...Arr.map(shapes, (shape) => createElement(Draw, { shape }))
  );
}

/** Draws one shape, and the shapes inside it. */
function Draw({ shape }: { shape: Shape }): ReactElement {
  return Match.value(shape).pipe(
    Match.tag("g", ({ children, part, transform }) =>
      createElement(
        "g",
        { "data-part": part, transform },
        createElement(Shapes, { shapes: children })
      )
    ),
    Match.tag("path", ({ _tag, limb, ...paint }) =>
      createElement(_tag, { "data-limb": limb, ...paint })
    ),
    Match.tag("ellipse", ({ _tag, eye, ...paint }) =>
      createElement(_tag, { "data-eye": eye, ...paint })
    ),
    Match.tag("circle", ({ _tag, ...paint }) => createElement(_tag, paint)),
    Match.tag("rect", ({ _tag, ...paint }) => createElement(_tag, paint)),
    Match.exhaustive
  );
}

/** Nina as a picture: an SVG of flat shapes, in the window that the scene asks for. */
export function Picture({ box, label, shapes, size }: PictureProps) {
  const named = label !== "";
  return (
    <svg
      aria-hidden={named ? undefined : true}
      aria-label={named ? label : undefined}
      className="block shrink-0"
      height={Math.round((size * box[3]) / box[2])}
      role={named ? "img" : undefined}
      viewBox={`${box[0]} ${box[1]} ${box[2]} ${box[3]}`}
      width={size}
    >
      <Shapes shapes={shapes} />
    </svg>
  );
}
