import { Schema } from "effect";
export const tryoutTrackKindValidator = Schema.Literals(["subject", "year"]);
export const tryoutSectionVisibilityValidator = Schema.Literals([
  "internal-entry",
  "visible",
]);
