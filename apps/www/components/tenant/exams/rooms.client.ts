"use client";

import type { GenericId } from "@confect/core";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The state that the rooms table filters by: every room, or the rooms in one of the sitting
 * states. The table's filter names these, and the server reads only the states it is given.
 */
export const RoomStateFilter = Schema.Literals([
  "all",
  "scheduled",
  "open",
  "closed",
]);

/**
 * The arguments of one page of an exam's rooms, with the state the table filters by. Every state
 * leaves the state out of the arguments, so the server reads every room of the exam.
 */
export function roomsArgs(
  input: {
    readonly examId: GenericId.GenericId<"exams">;
    readonly slug: TenantSlug;
  },
  filter: typeof RoomStateFilter.Type
) {
  if (filter === "all") {
    return { examId: input.examId, slug: input.slug };
  }
  return { examId: input.examId, slug: input.slug, state: filter };
}
