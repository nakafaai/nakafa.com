"use client";

import type { GenericId } from "@confect/core";
import type { OptimisticUpdate } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";

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

/**
 * Takes a cancelled room off every loaded page of the exam rooms of the school, at once. A
 * refused cancel is undone by Confect when the server answers.
 */
export const cancelRoomChange: OptimisticUpdate<
  typeof exams.sittings.cancel
> = (localStore, { sittingId, slug }) => {
  for (const query of localStore.getAllQueries(exams.rooms.list)) {
    if (Option.isSome(query.value) && query.args.slug === slug) {
      localStore.setQuery(
        exams.rooms.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.filter(
            query.value.value.page,
            (room) => room.id !== sittingId
          ),
        })
      );
    }
  }
};
