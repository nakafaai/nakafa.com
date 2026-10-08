import type { MathVisualSchema } from "@nakafa/aksara-contracts/math/visual";

/** The contract's union lists the plane scene first and the space scene second. */
type MathVisualMembers = (typeof MathVisualSchema)["members"];

export type PlaneVisual = MathVisualMembers[0]["Type"];
export type SpaceVisual = MathVisualMembers[1]["Type"];
export type PlaneObject = PlaneVisual["objects"][number];
export type SpaceObject = SpaceVisual["objects"][number];
export type MathAppearance = PlaneObject["appearance"];
export type PlanePoint = Extract<PlaneObject, { readonly kind: "point" }>["at"];
export type SpacePoint = Extract<SpaceObject, { readonly kind: "point" }>["at"];
