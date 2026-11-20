import { useFrame } from "@react-three/fiber";
import {
  BLOCK,
  MICRONS,
} from "@repo/design-system/components/contents/biology/capillary/bed";
import { erythrocyteOutline } from "@repo/design-system/components/contents/biology/capillary/erythrocyte";
import type { Axis } from "@repo/design-system/components/contents/biology/capillary/sweep";
import {
  directionOn,
  pointOn,
} from "@repo/design-system/components/contents/biology/capillary/sweep";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { CAPILLARY_COLORS } from "@repo/design-system/lib/material/capillary";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import {
  Color,
  DoubleSide,
  LatheGeometry,
  Matrix4,
  MeshPhysicalMaterial,
  Plane,
  Quaternion,
  Vector2,
  Vector3,
} from "three";

/**
 * How fast the blood moves in the drawing, in scene units a second. Blood in
 * a capillary moves about a millimetre a second at most, which at this
 * magnification would cross the bed in a blink, so the drawing slows it
 * several hundred times; each vessel keeps the same flow, so the wide venule
 * runs slower than the capillaries that fill it.
 */
export const SPEED = { arteriole: 0.55, capillary: 0.6, venule: 0.32 } as const;

/** The block's front face, where the cut opens the arteriole and the venule: blood beyond it is cut away. */
const FRONT = new Plane(new Vector3(0, 0, -1), BLOCK.front);

/** The time the blood has flowed for, which runs only while the card plays. */
export function useFlowTime(start: number) {
  const playing = useVisualScene((card) => card.playing, false);
  const time = useRef(start);
  useFrame((_, delta) => {
    if (playing) {
      time.current += simulationStep(delta);
    }
  });
  return time;
}

/** The two shapes of a red cell: the resting biconcave disc and the parachute it folds into inside a capillary. */
export function useRedCell(fit?: number) {
  const geometry = useMemo(() => {
    const outline = Arr.map(
      erythrocyteOutline(14, fit),
      ([r, height]) => new Vector2(r / MICRONS, height / MICRONS)
    );
    return new LatheGeometry(outline, 30);
  }, [fit]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** A red cell's membrane: a soft, slightly glossy red, cut open where the block's face cuts it. */
export function useCellMaterial() {
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 0.35,
        clearcoatRoughness: 0.4,
        clippingPlanes: [FRONT],
        roughness: 0.42,
        sheen: 0.5,
        sheenColor: new Color(CAPILLARY_COLORS.cellRim),
        side: DoubleSide,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

/** The scratch objects a moving cell is placed with, made once so no frame allocates. */
export function useScratch() {
  return useMemo(
    () => ({
      direction: new Vector3(),
      matrix: new Matrix4(),
      spin: new Vector3(),
      point: new Vector3(),
      scale: new Vector3(1, 1, 1),
      tilt: new Quaternion(),
      turn: new Quaternion(),
      up: new Vector3(0, 1, 0),
    }),
    []
  );
}

/** Writes into `scratch.matrix` a red cell tumbling gently as it flows along `axis`. */
export function placeCell(
  scratch: ReturnType<typeof useScratch>,
  axis: Axis,
  along: number,
  out: number,
  angle: number,
  seed: number,
  time: number
) {
  pointOn(axis, along, out, angle, scratch.point);
  directionOn(axis, along, scratch.direction);
  scratch.turn.setFromUnitVectors(scratch.up, scratch.direction);
  scratch.spin
    .set(hashUnit(seed, 1) - 0.5, 0, hashUnit(seed, 2) - 0.5)
    .normalize();
  scratch.tilt.setFromAxisAngle(
    scratch.spin,
    0.5 * Math.sin(time * 0.7 + seed) + (hashUnit(seed, 3) - 0.5)
  );
  scratch.turn.multiply(scratch.tilt);
  scratch.matrix.compose(scratch.point, scratch.turn, scratch.scale);
}
