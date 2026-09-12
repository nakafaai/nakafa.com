import { Effect, Schema } from "effect";
import { type Camera, Matrix4, Vector2, Vector3, Vector4 } from "three";

const EndpointStateSchema = Schema.Literals(["open", "closed"]);

/** Membership of the first and last authored points in a graph branch. */
export const LineEndpointsSchema = Schema.Struct({
  start: Schema.optionalKey(EndpointStateSchema),
  end: Schema.optionalKey(EndpointStateSchema),
});
export type LineEndpoints = typeof LineEndpointsSchema.Type;

/** Endpoint declarations must identify actual, unambiguous points. */
export class LineEndpointError extends Schema.TaggedError<LineEndpointError>()(
  "LineEndpointError",
  { message: Schema.String }
) {}

/** Resolves endpoint membership without inventing or moving source points. */
export const resolveLineEndpoints = Effect.fn("line.resolveEndpoints")(
  function* <Point>(points: readonly Point[], endpoints?: unknown) {
    if (endpoints === undefined) {
      return [];
    }
    const declared = yield* Schema.decodeUnknownEffect(LineEndpointsSchema)(
      endpoints
    ).pipe(
      Effect.mapError(
        (error) => new LineEndpointError({ message: error.message })
      )
    );
    if (points.length === 0 && (declared.start || declared.end)) {
      return yield* new LineEndpointError({
        message: "An endpoint requires at least one authored point.",
      });
    }
    if (
      points.length === 1 &&
      declared.start &&
      declared.end &&
      declared.start !== declared.end
    ) {
      return yield* new LineEndpointError({
        message: "A single point cannot be both included and excluded.",
      });
    }
    const result: {
      index: number;
      point: Point;
      state: typeof EndpointStateSchema.Type;
    }[] = [];
    if (declared.start) {
      result.push({ index: 0, point: points[0], state: declared.start });
    }
    if (declared.end && !(points.length === 1 && declared.start)) {
      const index = points.length - 1;
      result.push({
        index,
        point: points[index],
        state: declared.end,
      });
    }
    return result;
  }
);

/** Clips only presentation geometry so an open billboard remains hollow. */
export function clipOpenLineEnds(
  points: readonly Vector3[],
  endpoints: LineEndpoints,
  camera: Camera,
  radius: number,
  worldMatrix = new Matrix4()
): readonly Vector3[] {
  if (endpoints.start !== "open" && endpoints.end !== "open") {
    return points;
  }
  const scale = new Vector3().setFromMatrixScale(worldMatrix);
  const worldRadius = new Vector2(radius * scale.x, radius * scale.y);
  let clipped = points.map((point) => point.clone().applyMatrix4(worldMatrix));
  if (endpoints.start === "open") {
    clipped = clipStart(clipped, camera, worldRadius);
  }
  if (endpoints.end === "open") {
    clipped = clipStart(clipped.reverse(), camera, worldRadius).reverse();
  }
  const inverse = worldMatrix.clone().invert();
  return clipped.map((point) => point.clone().applyMatrix4(inverse));
}

/** Finds the exact screen-circle crossing, including perspective division. */
function clipStart(
  points: readonly Vector3[],
  camera: Camera,
  radius: Vector2
) {
  const first = points[0];
  if (!first) {
    return [];
  }
  const center = first.clone().project(camera);
  const right = new Vector3()
    .setFromMatrixColumn(camera.matrixWorld, 0)
    .normalize();
  const up = new Vector3()
    .setFromMatrixColumn(camera.matrixWorld, 1)
    .normalize();
  const rx =
    first.clone().addScaledVector(right, radius.x).project(camera).x - center.x;
  const ry =
    first.clone().addScaledVector(up, radius.y).project(camera).y - center.y;
  const projected = (point: Vector3) => {
    const clip = new Vector4(point.x, point.y, point.z, 1)
      .applyMatrix4(camera.matrixWorldInverse)
      .applyMatrix4(camera.projectionMatrix);
    return {
      point: new Vector2(
        (clip.x / clip.w - center.x) / rx,
        (clip.y / clip.w - center.y) / ry
      ),
      w: clip.w,
    };
  };
  let previous = projected(first);
  for (let index = 1; index < points.length; index += 1) {
    const current = projected(points[index]);
    if (current.point.lengthSq() >= 1) {
      const direction = current.point.clone().sub(previous.point);
      const a = direction.lengthSq();
      const b = 2 * previous.point.dot(direction);
      const c = previous.point.lengthSq() - 1;
      const screenProgress = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
      const progress =
        (screenProgress * previous.w) /
        (current.w * (1 - screenProgress) + screenProgress * previous.w);
      const boundary = points[index - 1].clone().lerp(points[index], progress);
      return [boundary, ...points.slice(index)];
    }
    previous = current;
  }
  return [];
}
