import type {
  Point,
  Rung,
} from "@repo/design-system/components/contents/biology/dna/ladder";
import {
  type Base,
  complementOf,
  type Nucleic,
} from "@repo/design-system/components/contents/biology/dna/strand";
import { MATERIAL } from "@repo/design-system/lib/material";
import { createContext, use } from "react";
import { Matrix4, Quaternion, Vector3 } from "three";

/** Each base keeps one colour in every lesson: the same hues as before, in the muted tones of a molecular model. */
const BASE_COLORS = {
  A: MATERIAL.adenine,
  C: MATERIAL.cytosine,
  G: MATERIAL.guanine,
  T: MATERIAL.thymine,
  U: MATERIAL.uracil,
} as const satisfies Record<Base, string>;

/**
 * How wide each base's slab is, in nanometres across the helix: the purines
 * A and G have two rings, the pyrimidines C, T and U one.
 */
const BASE_WIDTH = { A: 0.42, C: 0.3, G: 0.42, T: 0.3, U: 0.3 } as const;

/** The ladder lays the helix along x, so each slab lies across x, stacked on its neighbours. */
const HELIX_AXIS = new Vector3(1, 0, 0);

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
          base={base}
          from={rung.first}
          to={single ? stub(rung.first, rung.second) : middle}
        />
        {!single && <Rod base={partner} from={rung.second} to={middle} />}
      </>
    );
  }
  const upper = rung.copied ? rung.newFirst : stub(rung.first, rung.newFirst);
  const lower = rung.copied
    ? rung.newSecond
    : stub(rung.second, rung.newSecond);
  return (
    <>
      <Rod base={base} from={rung.first} to={midpoint(rung.first, upper)} />
      {rung.copied && (
        <BaseGlow value={false}>
          <Rod
            base={partner}
            from={rung.newFirst}
            to={midpoint(rung.first, upper)}
          />
        </BaseGlow>
      )}
      {!single && (
        <>
          <BaseGlow value={false}>
            <Rod
              base={partner}
              from={rung.second}
              to={midpoint(rung.second, lower)}
            />
          </BaseGlow>
          {rung.copied && (
            <BaseGlow value={false}>
              <Rod
                base={base}
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

/**
 * A base drawn as a flat slab from its backbone to the middle of the helix,
 * lying across the helix axis as the bases stack, glowing where `BaseGlow`
 * says so.
 */
function Rod({
  base,
  from,
  to,
}: {
  readonly base: Base;
  readonly from: Point;
  readonly to: Point;
}) {
  const glow = use(BaseGlow);
  const color = BASE_COLORS[base];
  const start = new Vector3(from[0], from[1], from[2]);
  const end = new Vector3(to[0], to[1], to[2]);
  const length = start.distanceTo(end);
  const along = end.clone().sub(start).normalize();
  const flat = new Vector3().crossVectors(along, HELIX_AXIS).normalize();
  const stack = new Vector3().crossVectors(flat, along);
  const quaternion = new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(flat, along, stack)
  );
  const center = start.add(end).multiplyScalar(0.5);
  return (
    <mesh castShadow position={center} quaternion={quaternion}>
      <boxGeometry
        args={[BASE_WIDTH[base], Math.max(0.01, length - 0.04), 0.09]}
      />
      <meshPhysicalMaterial
        clearcoat={0.5}
        clearcoatRoughness={0.3}
        color={color}
        emissive={color}
        emissiveIntensity={glow ? 1.6 : 0}
        roughness={0.45}
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
