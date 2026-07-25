import { literals } from "convex-helpers/validators";

export const tryoutTrackKindValidator = literals("subject", "year");

export const tryoutSectionVisibilityValidator = literals(
  "internal-entry",
  "visible"
);
