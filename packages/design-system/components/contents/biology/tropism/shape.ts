import { Array as Arr } from "effect";

/**
 * The centre line of a growing organ in its plane, as points from its base
 * to its tip: it leaves the base along `heading` (radians from +x, counter
 * clockwise), runs straight for its lower `straight` share, then curves
 * evenly through `bend` radians (counter clockwise when positive) over the
 * rest, where its cells elongate, so its length stays `length`.
 */
export function organPath({
  bend,
  heading,
  length,
  samples,
  straight,
}: {
  readonly bend: number;
  readonly heading: number;
  readonly length: number;
  readonly samples: number;
  readonly straight: number;
}) {
  const stem = length * straight;
  const arc = length - stem;
  return Arr.map(Arr.range(0, samples), (step) => {
    const s = (length * step) / samples;
    if (s <= stem) {
      return [s * Math.cos(heading), s * Math.sin(heading)] as const;
    }
    const along = s - stem;
    const start = [stem * Math.cos(heading), stem * Math.sin(heading)] as const;
    if (Math.abs(bend) < 1e-9) {
      return [
        start[0] + along * Math.cos(heading),
        start[1] + along * Math.sin(heading),
      ] as const;
    }
    const radius = arc / bend;
    const turn = (along / arc) * bend;
    return [
      start[0] + radius * (Math.sin(heading + turn) - Math.sin(heading)),
      start[1] - radius * (Math.cos(heading + turn) - Math.cos(heading)),
    ] as const;
  });
}

/** The direction an organ's tip points after it curved through `bend` from `heading`, in radians. */
export function tipHeading(heading: number, bend: number) {
  return heading + bend;
}
