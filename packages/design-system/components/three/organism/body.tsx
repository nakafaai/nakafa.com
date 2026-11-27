import { useFrame } from "@react-three/fiber";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { bodyDetail } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import { fuseForms } from "@repo/design-system/components/three/organism/form";
import type { Stroke } from "@repo/design-system/components/three/organism/life";
import { strokeInto } from "@repo/design-system/components/three/organism/life";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { InstancedBufferAttribute } from "three";

/**
 * The geometry of one living body, fused from its parts once at the stage's
 * own level of detail and freed when the body goes away. `shape` names the
 * parts and must keep its identity between renders, so declare it at module
 * level.
 */
function useBody(shape: (detail: number) => readonly Form[]) {
  const { tier } = useStage();
  const geometry = useMemo(
    () => fuseForms(shape(bodyDetail(tier))),
    [shape, tier]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * Swims a body while the card plays: bends its vertices in place along the
 * `stroke`, `pace` radians a second from `start`, allocating nothing.
 */
function useStroke(
  geometry: ReturnType<typeof useBody>,
  stroke: Stroke | undefined,
  pace: number,
  start: number
) {
  const rest = useMemo(
    () => Float32Array.from(geometry.getAttribute("position").array),
    [geometry]
  );
  const phase = useRef(start);
  const playing = useVisualScene((card) => card.playing, false);

  useFrame((_, delta) => {
    const position = geometry.getAttribute("position");
    const live = position.array;
    if (stroke === undefined || !playing || !(live instanceof Float32Array)) {
      return;
    }
    phase.current += simulationStep(delta) * pace;
    strokeInto(rest, live, stroke, phase.current);
    position.needsUpdate = true;
  });
}

/**
 * A living body: its trunk, fins, limbs and head as one smooth mesh that
 * casts and takes shadows, drawn at the stage tier's level of detail. With
 * a `stroke` it swims while the card plays. The skin is its child.
 *
 * @param shape - The body's parts at a level of detail, declared at module level
 * @param stroke - How the body bends as it swims or sways
 * @param pace - Radians of the stroke a second
 * @param start - The phase the stroke starts at, so neighbours are out of step
 * @param cast - Whether it casts and takes shadows: not for jelly or light
 */
export function Body({
  cast = true,
  children,
  pace = 0,
  shape,
  start = 0,
  stroke,
}: {
  readonly cast?: boolean;
  readonly children: ReactNode;
  readonly pace?: number;
  readonly shape: (detail: number) => readonly Form[];
  readonly start?: number;
  readonly stroke?: Stroke;
}) {
  const geometry = useBody(shape);
  useStroke(geometry, stroke, pace, start);

  return (
    <mesh castShadow={cast} geometry={geometry} receiveShadow={cast}>
      {children}
    </mesh>
  );
}

/**
 * Many copies of one living part in a single draw call, all sharing one
 * geometry: a shoal, a meadow of seagrass, a fringe of tentacles, hairs,
 * teeth, villi. `placements` come from `scatter`. With a `stroke` every
 * copy sways while the card plays. The skin is its child.
 *
 * @param shape - The one part every copy draws, declared at module level
 * @param placements - Sixteen numbers a copy, from `scatter`
 * @param stroke - How each copy bends as it sways
 * @param pace - Radians of the stroke a second
 * @param cast - Whether the copies cast and take shadows: not for light or jelly
 */
export function Tuft({
  cast = true,
  children,
  pace = 0,
  placements,
  shape,
  stroke,
}: {
  readonly cast?: boolean;
  readonly children: ReactNode;
  readonly pace?: number;
  readonly placements: Float32Array;
  readonly shape: (detail: number) => readonly Form[];
  readonly stroke?: Stroke;
}) {
  const geometry = useBody(shape);
  useStroke(geometry, stroke, pace, 0);
  const matrices = useMemo(
    () => new InstancedBufferAttribute(placements, 16),
    [placements]
  );

  return (
    <instancedMesh
      args={[geometry, undefined, placements.length / 16]}
      castShadow={cast}
      frustumCulled={false}
      instanceMatrix={matrices}
      receiveShadow={cast}
    >
      {children}
    </instancedMesh>
  );
}
