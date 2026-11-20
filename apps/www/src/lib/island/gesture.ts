import { Schema } from "effect";

/** A pointer's position on the screen, in CSS pixels. */
export const Point = Schema.Struct({ x: Schema.Finite, y: Schema.Finite });
export type Point = typeof Point.Type;
