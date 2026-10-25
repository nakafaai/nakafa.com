import type {
  PlaneObject,
  PlaneVisual,
  SpaceObject,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";

export function plane(first: PlaneObject, ...rest: PlaneObject[]): PlaneVisual {
  return {
    frame: {
      kind: "cartesian",
      x: { max: 5, min: -5 },
      y: { max: 4, min: -4 },
    },
    objects: [first, ...rest],
    space: "plane",
    view: { kind: "fit" },
  };
}

export function space(first: SpaceObject, ...rest: SpaceObject[]): SpaceVisual {
  return {
    frame: {
      kind: "cartesian",
      x: { max: 6, min: -6 },
      y: { max: 5, min: -5 },
      z: { max: 4, min: -4 },
    },
    objects: [first, ...rest],
    space: "space",
    view: { kind: "fit" },
  };
}
