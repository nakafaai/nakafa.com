"use client";

import type { GenericId } from "@confect/core";
import type { OptimisticUpdate } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { RoomRow } from "@repo/backend/confect/exams/rooms";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Order, Schema } from "effect";

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

/** One room of the rooms list, as the list holds it. */
type Room = typeof RoomRow.Type;

/**
 * Shows a room while the server schedules it: in the first page of each loaded list of the exam's
 * rooms that holds the scheduled rooms, in the order the list keeps, by opening. The room has a
 * placeholder ID until the server answers, and its row is inert until then.
 */
export const insertPlaceholderRoom =
  (room: Room): OptimisticUpdate<typeof exams.exams.schedule> =>
  (localStore, args) => {
    for (const query of localStore.getAllQueries(exams.rooms.list)) {
      if (
        Option.isSome(query.value) &&
        query.args.examId === args.examId &&
        query.args.slug === args.slug &&
        (query.args.state === undefined || query.args.state === "scheduled") &&
        query.args.paginationOpts.cursor === null
      ) {
        localStore.setQuery(
          exams.rooms.list,
          query.args,
          Option.some({
            ...query.value.value,
            page: Arr.sort(
              [room, ...query.value.value.page],
              Order.mapInput(Order.Number, (item: Room) => item.opensAt)
            ),
          })
        );
      }
    }
  };
