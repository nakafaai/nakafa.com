import type {
  Point,
  Rung,
} from "@repo/design-system/components/contents/biology/dna/ladder";
import {
  type Base,
  complementOf,
  type Nucleic,
} from "@repo/design-system/components/contents/biology/dna/strand";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { createContext, use } from "react";
import { Quaternion, Vector3 } from "three";

/** Each base keeps one colour in every lesson, from the plot palette. */
const BASE_COLORS = {
  A: PLOT_COLORS.amber,
  C: PLOT_COLORS.pink,
  G: PLOT_COLORS.violet,
  T: PLOT_COLORS.teal,
  U: PLOT_COLORS.orange,
} as const satisfies Record<Base, string>;

/** Whether the bases drawn inside glow: the scene sets it for each changed pair. */
export const BaseGlow = createContext(false);

/**
 * One base pair: the parent's base reaching in from its backbone and its
 * partner reaching back, joined in the middle. An opened pair shows each
 * parent's base waiting, or paired with its new partner once copied. The
 * parents' bases glow where `BaseGlow` says the base changed, and a newly
 * laid partner never does.
 */
export function Pair({
  base,
  nucleic,
  rung,
  single,
}: {
  readonly base: Base;
  readonly nucleic: Nucleic;
  readonly rung: Rung;
  readonly single: boolean;
}) {
  const partner = complementOf(base, nucleic);
  if (!rung.open) {
    const middle = midpoint(rung.first, rung.second);
    return (
      <>
        <Rod
          color={BASE_COLORS[base]}
          from={rung.first}
          to={single ? stub(rung.first, rung.second) : middle}
        />
        {!single && (
          <Rod color={BASE_COLORS[partner]} from={rung.second} to={middle} />
        )}
      </>
    );
  }
  const upper = rung.copied ? rung.newFirst : stub(rung.first, rung.newFirst);
  const lower = rung.copied
    ? rung.newSecond
    : stub(rung.second, rung.newSecond);
  return (
    <>
      <Rod
        color={BASE_COLORS[base]}
        from={rung.first}
        to={midpoint(rung.first, upper)}
      />
      {rung.copied && (
        <BaseGlow value={false}>
          <Rod
            color={BASE_COLORS[partner]}
            from={rung.newFirst}
            to={midpoint(rung.first, upper)}
          />
        </BaseGlow>
      )}
      {!single && (
        <>
          <BaseGlow value={false}>
            <Rod
              color={BASE_COLORS[partner]}
              from={rung.second}
              to={midpoint(rung.second, lower)}
            />
          </BaseGlow>
          {rung.copied && (
            <BaseGlow value={false}>
              <Rod
                color={BASE_COLORS[base]}
                from={rung.newSecond}
                to={midpoint(rung.second, lower)}
              />
            </BaseGlow>
          )}
        </>
      )}
    </>
  );
}

/** A base drawn as a rounded rod between two points, glowing where `BaseGlow` says so. */
function Rod({
  color,
  from,
  to,
}: {
  readonly color: string;
  readonly from: Point;
  readonly to: Point;
}) {
  const glow = use(BaseGlow);
  const start = new Vector3(from[0], from[1], from[2]);
  const end = new Vector3(to[0], to[1], to[2]);
  const length = start.distanceTo(end);
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    end.clone().sub(start).normalize()
  );
  const center = start.add(end).multiplyScalar(0.5);
  return (
    <mesh castShadow position={center} quaternion={quaternion}>
      <capsuleGeometry args={[0.1, Math.max(0.01, length - 0.2), 4, 10]} />
      <meshPhysicalMaterial
        clearcoat={0.4}
        color={color}
        emissive={color}
        emissiveIntensity={glow ? 1.6 : 0}
        roughness={0.4}
      />
    </mesh>
  );
}

/** The point halfway between two points. */
function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

/** A base on a lone strand reaches 45% of the way to where its partner would be. */
function stub(from: Point, toward: Point): Point {
  return [
    from[0] + (toward[0] - from[0]) * 0.45,
    from[1] + (toward[1] - from[1]) * 0.45,
    from[2] + (toward[2] - from[2]) * 0.45,
  ];
}
