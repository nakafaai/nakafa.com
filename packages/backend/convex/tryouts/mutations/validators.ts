import { v } from "convex/values";

/** Validates the public result contract returned by `startTryout`. */
export const startTryoutResultValidator = v.union(
  v.object({
    kind: v.literal("started"),
  }),
  v.object({
    kind: v.literal("competition-attempt-used"),
  }),
  v.object({
    kind: v.literal("requires-access"),
  }),
  v.object({
    kind: v.literal("not-ready"),
  }),
  v.object({
    kind: v.literal("not-found"),
  }),
  v.object({
    kind: v.literal("inactive"),
  })
);

/** Validates the public result contract returned by `startPart`. */
export const startPartResultValidator = v.union(
  v.object({
    kind: v.literal("started"),
  }),
  v.object({
    kind: v.literal("tryout-expired"),
  }),
  v.object({
    kind: v.literal("part-expired"),
  })
);

/** Validates the public result contract returned by `completePart`. */
export const completePartResultValidator = v.union(
  v.object({
    kind: v.literal("completed"),
  }),
  v.object({
    kind: v.literal("tryout-expired"),
  })
);
