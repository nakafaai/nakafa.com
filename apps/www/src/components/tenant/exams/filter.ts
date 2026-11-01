import type { GenericId } from "@confect/core";
import type { OptimisticUpdate } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { RoomRow } from "@repo/backend/confect/exams/rooms";
import type { SittingGroup } from "@repo/backend/confect/exams/sittings/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, pipe, Schema } from "effect";

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
 * The arguments of one page of an exam's rooms, with the state the table filters by and the search
 * of its header. Every state leaves the state out of the arguments, and an empty search leaves the
 * search out, so the server reads every room of the exam.
 */
export function roomsArgs(
  input: {
    readonly examId: GenericId.GenericId<"exams">;
    readonly slug: TenantSlug;
  },
  filter: typeof RoomStateFilter.Type,
  search: string
) {
  return {
    examId: input.examId,
    slug: input.slug,
    ...(filter === "all" ? {} : { state: filter }),
    ...(search === "" ? {} : { search }),
  };
}

/**
 * The key of a room's group in the rooms table's group filter: its kind with the ID of its cohort or unit, so two
 * groups of one name in two units stay apart.
 */
export const roomGroupKey = (group: typeof SittingGroup.Type) =>
  group.kind === "cohort" ? `cohort:${group.cohortId}` : `unit:${group.unitId}`;

/**
 * The groups that the loaded rooms run for, each once, in the order their first room shows: the options of the group
 * filter, each with its key, its kind and its name.
 */
export const roomGroups = (rooms: readonly (typeof RoomRow.Type)[]) =>
  pipe(
    Arr.map(rooms, (room) => ({
      key: roomGroupKey(room.group),
      kind: room.group.kind,
      name: room.groupName,
    })),
    Arr.dedupeWith((one, other) => one.key === other.key)
  );

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

/**
 * Shows a moved room at its new times and name on every loaded page of the exam rooms of the school, at once. Its
 * place in the order comes with the server's answer, and a refused move is undone by Confect.
 */
export const rescheduleRoomChange: OptimisticUpdate<
  typeof exams.sittings.reschedule
> = (localStore, { closesAt, opensAt, room, sittingId, slug }) => {
  for (const query of localStore.getAllQueries(exams.rooms.list)) {
    if (Option.isSome(query.value) && query.args.slug === slug) {
      localStore.setQuery(
        exams.rooms.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.map(query.value.value.page, (row) =>
            row.id === sittingId ? { ...row, closesAt, opensAt, room } : row
          ),
        })
      );
    }
  }
};
