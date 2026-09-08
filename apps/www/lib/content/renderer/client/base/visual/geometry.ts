import { createCuboid } from "@repo/design-system/lib/geometry/cuboid";
import {
  clipPlaneLine,
  clipPlanePath,
  clipSpaceLine,
  clipSpacePath,
  containsPlanePoint,
  containsSpacePoint,
} from "@/lib/content/renderer/client/base/visual/clip";
import { resolvePlaneCurve } from "@/lib/content/renderer/client/base/visual/curve";
import type {
  MathAppearance,
  PlaneObject,
  PlanePoint,
  PlaneVisual,
  SpaceObject,
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import {
  projectVisualPoint,
  resolveVisualProjection,
  type VisualProjection,
} from "@/lib/content/renderer/client/base/visual/transform";
export type MathPathArrows = "both" | "end" | "none";
interface VisualMarker {
  readonly appearance: MathAppearance;
  readonly at: SpacePoint;
  readonly id: string;
}
interface VisualPath {
  readonly appearance: MathAppearance;
  readonly arrows: MathPathArrows;
  readonly id: string;
  readonly points: readonly SpacePoint[];
}
interface VisualRegion {
  readonly appearance: MathAppearance;
  readonly id: string;
  readonly vertices: readonly SpacePoint[];
}
export interface VisualGeometry {
  readonly markers: VisualMarker[];
  readonly paths: VisualPath[];
  readonly regions: VisualRegion[];
}
function arrows(
  kind: PlaneObject["kind"] | SpaceObject["kind"]
): MathPathArrows {
  if (kind === "line") {
    return "both";
  }
  return kind === "ray" ? "end" : "none";
}
function appendPath(geometry: VisualGeometry, path: VisualPath) {
  const first = path.points[0];
  if (
    first &&
    path.points.every(
      ({ x, y, z }) => x === first.x && y === first.y && z === first.z
    )
  ) {
    geometry.markers.push({
      appearance: path.appearance,
      at: first,
      id: path.id,
    });
    return;
  }
  geometry.paths.push(path);
}
function appendPaths(
  geometry: VisualGeometry,
  object: PlaneObject | SpaceObject,
  paths: readonly (readonly (PlanePoint | SpacePoint)[])[],
  projection: VisualProjection
) {
  for (const [index, points] of paths.entries()) {
    appendPath(geometry, {
      appearance: object.appearance,
      arrows: arrows(object.kind),
      id: paths.length === 1 ? object.id : `${object.id}:part:${index + 1}`,
      points: points.map((point) => projectVisualPoint(point, projection)),
    });
  }
}
function appendPlane(
  geometry: VisualGeometry,
  scene: PlaneVisual,
  projection: VisualProjection,
  object: PlaneObject
) {
  if (object.kind === "point") {
    if (containsPlanePoint(scene.frame, object.at)) {
      geometry.markers.push({
        appearance: object.appearance,
        at: projectVisualPoint(object.at, projection),
        id: object.id,
      });
    }
    return;
  }
  if (
    object.kind === "arc" ||
    object.kind === "circle" ||
    object.kind === "quadratic"
  ) {
    appendPath(geometry, {
      appearance: object.appearance,
      arrows: "none",
      id: object.id,
      points: resolvePlaneCurve(object, projection),
    });
    return;
  }
  if (object.kind === "polygon") {
    geometry.regions.push({
      appearance: object.appearance,
      id: object.id,
      vertices: object.vertices.map((point) =>
        projectVisualPoint(point, projection)
      ),
    });
    appendPaths(
      geometry,
      object,
      [[...object.vertices, object.vertices[0]]],
      projection
    );
    return;
  }
  if (object.kind === "line" || object.kind === "ray") {
    const path =
      object.kind === "line"
        ? clipPlaneLine(scene.frame, ...object.through, false)
        : clipPlaneLine(scene.frame, object.from, object.through, true);
    appendPaths(geometry, object, path ? [path] : [], projection);
    return;
  }
  appendPaths(
    geometry,
    object,
    clipPlanePath(
      scene.frame,
      object.kind === "segment" ? [object.from, object.to] : object.vertices
    ),
    projection
  );
}
function appendSpace(
  geometry: VisualGeometry,
  scene: SpaceVisual,
  projection: VisualProjection,
  object: SpaceObject
) {
  if (object.kind === "point") {
    if (containsSpacePoint(scene.frame, object.at)) {
      geometry.markers.push({
        appearance: object.appearance,
        at: projectVisualPoint(object.at, projection),
        id: object.id,
      });
    }
    return;
  }
  if (object.kind === "cuboid") {
    const cuboid = createCuboid({ center: object.center, ...object.size });
    for (const [index, edge] of cuboid.edges.entries()) {
      appendPaths(
        geometry,
        { ...object, id: `${object.id}:edge:${index + 1}` },
        clipSpacePath(scene.frame, edge),
        projection
      );
    }
    return;
  }
  if (object.kind === "line" || object.kind === "ray") {
    const path =
      object.kind === "line"
        ? clipSpaceLine(scene.frame, ...object.through, false)
        : clipSpaceLine(scene.frame, object.from, object.through, true);
    appendPaths(geometry, object, path ? [path] : [], projection);
    return;
  }
  appendPaths(
    geometry,
    object,
    clipSpacePath(
      scene.frame,
      object.kind === "segment" ? [object.from, object.to] : object.vertices,
      object.kind === "polygon"
    ),
    projection
  );
}
/** Resolves both scene dimensions into shared three-dimensional primitives. */
export function resolveVisualGeometry(
  scene: PlaneVisual | SpaceVisual,
  projection = resolveVisualProjection(scene)
): VisualGeometry {
  const geometry: VisualGeometry = { markers: [], paths: [], regions: [] };
  if (scene.space === "plane") {
    for (const object of scene.objects) {
      appendPlane(geometry, scene, projection, object);
    }
  } else {
    for (const object of scene.objects) {
      appendSpace(geometry, scene, projection, object);
    }
  }
  return geometry;
}
