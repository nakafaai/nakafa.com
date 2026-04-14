import {
  schoolClassImageValidator,
  schoolClassVisibilityValidator,
} from "@repo/backend/convex/classes/schema";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/**
 * The minimal class fields needed to render the class join screen.
 */
export const classRouteJoinClassValidator = v.object({
  _id: vv.id("schoolClasses"),
  image: schoolClassImageValidator,
  name: v.string(),
  subject: v.string(),
  visibility: schoolClassVisibilityValidator,
  year: v.string(),
});

/**
 * The class route snapshot returned when the viewer can enter the class shell.
 */
export const classRouteAccessibleValidator = v.object({
  kind: v.literal("accessible"),
  class: vv.doc("schoolClasses"),
  classMembership: nullable(vv.doc("schoolClassMembers")),
  schoolMembership: vv.doc("schoolMembers"),
});

/**
 * The class route snapshot returned when the viewer must join the class first.
 */
export const classRouteJoinValidator = v.object({
  kind: v.literal("joinRequired"),
  class: classRouteJoinClassValidator,
  schoolMembership: vv.doc("schoolMembers"),
});

/**
 * One cohesive route contract for the class shell.
 */
export const classRouteResultValidator = v.union(
  classRouteAccessibleValidator,
  classRouteJoinValidator
);
export type ClassRouteResult = Infer<typeof classRouteResultValidator>;

/** Return shape for class join mutations. */
export const classJoinMutationResultValidator = v.object({
  classId: vv.id("schoolClasses"),
});
