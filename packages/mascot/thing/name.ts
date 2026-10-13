import { Schema } from "effect";

/**
 * The 32 things of Nina's world, in the order they are shown: what she holds,
 * what the product shows, and what lies on a learner's desk and in the bag.
 */
export const ThingNameSchema = Schema.Literals([
  "book",
  "pencil",
  "padlock",
  "key",
  "magnifier",
  "bubble",
  "check",
  "coffee",
  "medal",
  "note",
  "balls",
  "eraser",
  "ruler",
  "backpack",
  "stopwatch",
  "calendar",
  "trophy",
  "bulb",
  "calculator",
  "letter",
  "plane",
  "highlighter",
  "glasses",
  "cap",
  "shield",
  "headphones",
  "donut",
  "hourglass",
  "globe",
  "clip",
  "flag",
  "board",
]);

/** The name of one thing. */
export type ThingName = typeof ThingNameSchema.Type;
