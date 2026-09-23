import type { CoordinateTuple } from "@repo/design-system/components/three/frame";
import { Effect, Schema } from "effect";
import { Vector3 } from "three";

export const LOAD_MIN_X = -1.2;
export const LOAD_MAX_X = 1.2;
export const LOAD_STEP = 0.1;

const LoadPosition = Schema.Finite.check(
  Schema.isBetween({ minimum: LOAD_MIN_X, maximum: LOAD_MAX_X })
);
const LOAD_WEIGHT_NEWTON = 120;
const VECTOR_NEWTONS_PER_SCENE_UNIT = 100;

export type VectorConceptState = Effect.Success<
  ReturnType<typeof getVectorState>
>;

/** Solves the two cable forces and projects both with the same Newton scale. */
export const getVectorState = Effect.fn("vector.getVectorState")(function* (
  loadX: typeof LoadPosition.Type
) {
  const position = yield* Schema.decodeEffect(LoadPosition)(loadX);
  const loadPoint = [position, 0.3, 0] satisfies CoordinateTuple;
  const leftAnchor = [-2.15, 2.2, 0] satisfies CoordinateTuple;
  const rightAnchor = [2.15, 2.2, 0] satisfies CoordinateTuple;
  const left = getCableDirection(loadPoint, leftAnchor);
  const right = getCableDirection(loadPoint, rightAnchor);
  const leftCosine = -left.x;
  const rightCosine = right.x;
  const leftTension =
    LOAD_WEIGHT_NEWTON / (left.y + (leftCosine * right.y) / rightCosine);
  const rightTension = (leftTension * leftCosine) / rightCosine;

  return {
    loadPoint,
    left: projectCable(loadPoint, left, leftAnchor, leftTension),
    right: projectCable(loadPoint, right, rightAnchor, rightTension),
  };
});

function getCableDirection(start: CoordinateTuple, end: CoordinateTuple) {
  return new Vector3()
    .subVectors(new Vector3(...end), new Vector3(...start))
    .normalize();
}

function projectCable(
  start: CoordinateTuple,
  direction: Vector3,
  anchor: CoordinateTuple,
  tension: number
) {
  const arrow = direction
    .clone()
    .multiplyScalar(tension / VECTOR_NEWTONS_PER_SCENE_UNIT);

  return {
    anchor,
    arrowEnd: [
      start[0] + arrow.x,
      start[1] + arrow.y,
      start[2] + arrow.z,
    ] satisfies CoordinateTuple,
    tension,
  };
}
