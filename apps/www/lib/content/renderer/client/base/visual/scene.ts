import type { MathVisual } from "@nakafa/aksara-contracts/math/visual";

export type PlaneVisual = Extract<MathVisual, { readonly space: "plane" }>;
export type SpaceVisual = Extract<MathVisual, { readonly space: "space" }>;
export type PlaneObject = PlaneVisual["objects"][number];
export type SpaceObject = SpaceVisual["objects"][number];
export type MathAppearance = PlaneObject["appearance"];
export type PlanePoint = Extract<PlaneObject, { readonly kind: "point" }>["at"];
export type SpacePoint = Extract<SpaceObject, { readonly kind: "point" }>["at"];
