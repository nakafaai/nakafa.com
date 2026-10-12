import { draw } from "@repo/mascot/draw";
import { forSeed } from "@repo/mascot/seed";
import { CANVAS, EYE_CLASS, type Part } from "@repo/mascot/shape";
import { markup } from "@repo/mascot/svg";
import { cn } from "cn";
import { Array as Arr, Match } from "effect";

interface Props {
  className?: string;
  name: string;
}

interface LayersProps {
  parts: readonly (typeof Part.Type)[];
}

interface LayerProps {
  part: typeof Part.Type;
}

/**
 * The profile animal of one person, in a round frame. The animal follows the
 * seed in `name`, so the same name always shows the same animal.
 */
export function Character({ name, className }: Props) {
  const { ground, parts, transform } = draw(forSeed(name));

  return (
    <svg
      aria-hidden="true"
      className={cn("block shrink-0 rounded-full border", className)}
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
    >
      <rect fill={ground} height={CANVAS} width={CANVAS} />
      <g transform={transform}>
        <Layers parts={parts} />
      </g>
    </svg>
  );
}

/** The layers of a picture, from back to front. Each is keyed by its own markup. */
function Layers({ parts }: LayersProps) {
  return Arr.map(parts, (part) => <Layer key={markup(part)} part={part} />);
}

/** One layer of a picture, as the SVG element that it describes. */
function Layer({ part }: LayerProps) {
  return Match.value(part).pipe(
    Match.tag("Ellipse", ({ cx, cy, fill, rx, ry, transform }) => (
      <ellipse
        cx={cx}
        cy={cy}
        fill={fill}
        rx={rx}
        ry={ry}
        transform={transform}
      />
    )),
    Match.tag("Eye", ({ cx, cy, fill, rx, ry }) => (
      <ellipse
        className={EYE_CLASS}
        cx={cx}
        cy={cy}
        fill={fill}
        rx={rx}
        ry={ry}
      />
    )),
    Match.tag("Fade", ({ opacity, shapes }) => (
      <g opacity={opacity}>
        <Layers parts={shapes} />
      </g>
    )),
    Match.tag("Line", ({ color, d, width }) => (
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={width}
      />
    )),
    Match.tag("Path", ({ d, fill, outline }) => (
      <path
        d={d}
        fill={fill}
        stroke={outline?.color}
        strokeLinejoin={outline ? "round" : undefined}
        strokeWidth={outline?.width}
      />
    )),
    Match.tag("Polygon", ({ fill, points, rounding }) => (
      <polygon
        fill={fill}
        points={points}
        stroke={fill}
        strokeLinejoin="round"
        strokeWidth={rounding}
      />
    )),
    Match.exhaustive
  );
}
