import {
  MathAppearanceSchema,
  SpacePointSchema,
} from "@nakafa/aksara-contracts/math/base";
import { createCuboid } from "@repo/design-system/lib/geometry/cuboid";
import { Array as Arr, MutableList, Schema } from "effect";
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

const MathPathArrowsSchema = Schema.Literals(["both", "end", "none"]);
type MathPathArrows = typeof MathPathArrowsSchema.Type;
const VisualMarkerSchema = Schema.Struct({
  appearance: MathAppearanceSchema,
  at: SpacePointSchema,
  id: Schema.String,
});
type VisualMarker = typeof VisualMarkerSchema.Type;
const VisualPathSchema = Schema.Struct({
  appearance: MathAppearanceSchema,
  arrows: MathPathArrowsSchema,
  id: Schema.String,
  points: Schema.Array(SpacePointSchema),
});
type VisualPath = typeof VisualPathSchema.Type;
const VisualRegionSchema = Schema.Struct({
  appearance: MathAppearanceSchema,
  id: Schema.String,
  vertices: Schema.Array(SpacePointSchema),
});
type VisualRegion = typeof VisualRegionSchema.Type;
const VisualGeometrySchema = Schema.Struct({
  markers: Schema.mutable(Schema.Array(VisualMarkerSchema)),
  paths: Schema.mutable(Schema.Array(VisualPathSchema)),
  regions: Schema.mutable(Schema.Array(VisualRegionSchema)),
});
type VisualGeometry = typeof VisualGeometrySchema.Type;
function arrows(
  kind: PlaneObject["kind"] | SpaceObject["kind"]
): MathPathArrows {
  if (kind === "line") {
    return "both";
  }
  return kind === "ray" ? "end" : "none";
}
/** Collects the markers, paths, and regions of one scene in the order its objects add them. */
function createGeometryBuilder() {
  return {
    markers: MutableList.make<VisualMarker>(),
    paths: MutableList.make<VisualPath>(),
    regions: MutableList.make<VisualRegion>(),
  };
}
type GeometryBuilder = ReturnType<typeof createGeometryBuilder>;
function appendPath(geometry: GeometryBuilder, path: VisualPath) {
  const first = path.points[0];
  if (
    first &&
    Arr.every(
      path.points,
      ({ x, y, z }) => x === first.x && y === first.y && z === first.z
    )
  ) {
    MutableList.append(geometry.markers, {
      appearance: path.appearance,
      at: first,
      id: path.id,
    });
    return;
  }
  MutableList.append(geometry.paths, path);
}
function appendPaths(
  geometry: GeometryBuilder,
  object: PlaneObject | SpaceObject,
  paths: readonly (readonly (PlanePoint | SpacePoint)[])[],
  projection: VisualProjection
) {
  Arr.forEach(paths, (points, index) => {
    appendPath(geometry, {
      appearance: object.appearance,
      arrows: arrows(object.kind),
      id: paths.length === 1 ? object.id : `${object.id}:part:${index + 1}`,
      points: Arr.map(points, (point) => projectVisualPoint(point, projection)),
    });
  });
}
function appendPlane(
  geometry: GeometryBuilder,
  scene: PlaneVisual,
  projection: VisualProjection,
  object: PlaneObject
) {
  if (object.kind === "point") {
    if (containsPlanePoint(scene.frame, object.at)) {
      MutableList.append(geometry.markers, {
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
    MutableList.append(geometry.regions, {
      appearance: object.appearance,
      id: object.id,
      vertices: Arr.map(object.vertices, (point) =>
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
  geometry: GeometryBuilder,
  scene: SpaceVisual,
  projection: VisualProjection,
  object: SpaceObject
) {
  if (object.kind === "point") {
    if (containsSpacePoint(scene.frame, object.at)) {
      MutableList.append(geometry.markers, {
        appearance: object.appearance,
        at: projectVisualPoint(object.at, projection),
        id: object.id,
      });
    }
    return;
  }
  if (object.kind === "cuboid") {
    const cuboid = createCuboid({ center: object.center, ...object.size });
    Arr.forEach(cuboid.edges, (edge, index) => {
      appendPaths(
        geometry,
        { ...object, id: `${object.id}:edge:${index + 1}` },
        clipSpacePath(scene.frame, edge),
        projection
      );
    });
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
  const geometry = createGeometryBuilder();
  if (scene.space === "plane") {
    for (const object of scene.objects) {
      appendPlane(geometry, scene, projection, object);
    }
  } else {
    for (const object of scene.objects) {
      appendSpace(geometry, scene, projection, object);
    }
  }
  return {
    markers: MutableList.takeAll(geometry.markers),
    paths: MutableList.takeAll(geometry.paths),
    regions: MutableList.takeAll(geometry.regions),
  };
}
