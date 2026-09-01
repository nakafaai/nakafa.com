import { createCuboid } from "@repo/design-system/lib/geometry/cuboid";

import {
  clipPlaneLine,
  clipPlanePath,
  clipSpaceLine,
  clipSpacePath,
  containsPlanePoint,
  containsSpacePoint,
} from "@/lib/content/renderer/client/base/visual/clip";
import type {
  MathAppearance,
  PlaneObject,
  PlanePoint,
  PlaneVisual,
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import {
  projectSpaceMeasure,
  projectSpacePoint,
  resolveSpaceProjection,
  type SpaceProjection,
} from "@/lib/content/renderer/client/base/visual/transform";

export type MathPathArrows = "both" | "end" | "none";

export interface ResolvedPlanePath {
  readonly appearance: MathAppearance;
  readonly arrows: MathPathArrows;
  readonly fill: boolean;
  readonly id: string;
  readonly kind: "path";
  readonly points: readonly PlanePoint[];
}

export type ResolvedPlaneObject =
  | Extract<
      PlaneObject,
      { readonly kind: "arc" | "circle" | "point" | "quadratic" }
    >
  | ResolvedPlanePath;

export interface ResolvedSpaceMarker {
  readonly appearance: MathAppearance;
  readonly at: SpacePoint;
  readonly id: string;
}

export interface ResolvedSpacePath {
  readonly appearance: MathAppearance;
  readonly arrows: MathPathArrows;
  readonly id: string;
  readonly points: readonly SpacePoint[];
}

export interface ResolvedSpaceGeometry {
  readonly markers: readonly ResolvedSpaceMarker[];
  readonly paths: readonly ResolvedSpacePath[];
}

function resolvePathArrows(kind: PlaneObject["kind"]): MathPathArrows {
  if (kind === "line") {
    return "both";
  }
  return kind === "ray" ? "end" : "none";
}

function privatePathId(id: string, index: number, count: number) {
  return count === 1 ? id : `${id}:part:${index + 1}`;
}

function isCollapsedPlanePath(points: readonly PlanePoint[]) {
  const first = points[0];
  return (
    first !== undefined &&
    points.every(({ x, y }) => x === first.x && y === first.y)
  );
}

function isCollapsedSpacePath(points: readonly SpacePoint[]) {
  const first = points[0];
  return (
    first !== undefined &&
    points.every(
      ({ x, y, z }) => x === first.x && y === first.y && z === first.z
    )
  );
}

function resolvePlanePaths(
  scene: PlaneVisual,
  object: Exclude<
    PlaneObject,
    { readonly kind: "arc" | "circle" | "point" | "quadratic" }
  >
): readonly (readonly PlanePoint[])[] {
  if (object.kind === "line") {
    const path = clipPlaneLine(scene.frame, ...object.through, false);
    return path ? [path] : [];
  }
  if (object.kind === "ray") {
    const path = clipPlaneLine(scene.frame, object.from, object.through, true);
    return path ? [path] : [];
  }
  if (object.kind === "segment") {
    return clipPlanePath(scene.frame, [object.from, object.to]);
  }
  if (object.kind === "polyline") {
    return clipPlanePath(scene.frame, object.vertices);
  }

  // SVG owns exact rectangular clipping for filled polygons. Keeping one
  // closed path preserves fill semantics that split edge paths cannot express.
  return [[...object.vertices, object.vertices[0]]];
}

/** Resolves authored plane objects into exact renderable primitives. */
export function resolvePlaneGeometry(scene: PlaneVisual) {
  const resolved: ResolvedPlaneObject[] = [];

  for (const object of scene.objects) {
    if (object.kind === "point") {
      if (containsPlanePoint(scene.frame, object.at)) {
        resolved.push(object);
      }
      continue;
    }
    if (
      object.kind === "circle" ||
      object.kind === "arc" ||
      object.kind === "quadratic"
    ) {
      resolved.push(object);
      continue;
    }

    const paths = resolvePlanePaths(scene, object);
    for (const [index, points] of paths.entries()) {
      const first = points[0];
      if (first && isCollapsedPlanePath(points)) {
        resolved.push({
          appearance: object.appearance,
          at: first,
          id: privatePathId(object.id, index, paths.length),
          kind: "point",
        });
        continue;
      }
      resolved.push({
        appearance: object.appearance,
        arrows: resolvePathArrows(object.kind),
        fill: object.kind === "polygon",
        id: privatePathId(object.id, index, paths.length),
        kind: "path",
        points,
      });
    }
  }

  return resolved;
}

function appendSpacePaths(
  markers: ResolvedSpaceMarker[],
  paths: ResolvedSpacePath[],
  object: Exclude<
    SpaceVisual["objects"][number],
    { readonly kind: "cuboid" | "point" }
  >,
  scene: SpaceVisual,
  projection: SpaceProjection
) {
  let clipped: readonly (readonly SpacePoint[])[];
  if (object.kind === "line") {
    const path = clipSpaceLine(scene.frame, ...object.through, false);
    clipped = path ? [path] : [];
  } else if (object.kind === "ray") {
    const path = clipSpaceLine(scene.frame, object.from, object.through, true);
    clipped = path ? [path] : [];
  } else if (object.kind === "segment") {
    clipped = clipSpacePath(scene.frame, [object.from, object.to]);
  } else {
    clipped = clipSpacePath(
      scene.frame,
      object.vertices,
      object.kind === "polygon"
    );
  }

  for (const [index, points] of clipped.entries()) {
    const first = points[0];
    if (first && isCollapsedSpacePath(points)) {
      markers.push({
        appearance: object.appearance,
        at: projectSpacePoint(first, projection),
        id: privatePathId(object.id, index, clipped.length),
      });
      continue;
    }
    paths.push({
      appearance: object.appearance,
      arrows: resolvePathArrows(object.kind),
      id: privatePathId(object.id, index, clipped.length),
      points: points.map((point) => projectSpacePoint(point, projection)),
    });
  }
}

/** Resolves authored space objects into clipped markers and straight paths. */
export function resolveSpaceGeometry(
  scene: SpaceVisual,
  projection = resolveSpaceProjection(scene)
): ResolvedSpaceGeometry {
  const markers: ResolvedSpaceMarker[] = [];
  const paths: ResolvedSpacePath[] = [];

  for (const object of scene.objects) {
    if (object.kind === "point") {
      if (containsSpacePoint(scene.frame, object.at)) {
        markers.push({
          appearance: object.appearance,
          at: projectSpacePoint(object.at, projection),
          id: object.id,
        });
      }
      continue;
    }
    if (object.kind === "cuboid") {
      const cuboid = createCuboid({
        center: projectSpacePoint(object.center, projection),
        height: projectSpaceMeasure(object.size.height, projection),
        length: projectSpaceMeasure(object.size.length, projection),
        width: projectSpaceMeasure(object.size.width, projection),
      });
      for (const [index, edge] of cuboid.edges.entries()) {
        paths.push({
          appearance: object.appearance,
          arrows: "none",
          id: `${object.id}:edge:${index + 1}`,
          points: edge,
        });
      }
      continue;
    }
    appendSpacePaths(markers, paths, object, scene, projection);
  }

  return { markers, paths };
}
