import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { RoomRow } from "@repo/backend/confect/exams/rooms";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";
import {
  cancelRoomChange,
  roomGroupKey,
  roomGroups,
  roomsArgs,
  roomsOfGroup,
} from "@/components/tenant/exams/filter";
import { createLocalStore } from "@/test/optimistic";

const input = {
  examId: Schema.decodeUnknownSync(Id("exams"))("exam-pts"),
  slug: Schema.decodeSync(TenantSlug)("nf"),
};

/** The unit and the cohort the rooms below run for. */
const unitId = Schema.decodeUnknownSync(Id("tenantUnits"))("unit-smp");
const cohortId = Schema.decodeUnknownSync(Id("tenantCohorts"))("cohort-7a");

/** One scheduled room of the exam, as the rooms list shows it, for the unit's whole group unless a cohort is named. */
const room = (
  id: string,
  name: string,
  group: typeof RoomRow.Type.group = { kind: "unit", unitId },
  groupName = "SMP Nakafa"
): typeof RoomRow.Type => ({
  canCancel: false,
  closesAt: 1_800_000_000_000,
  group,
  groupName,
  id: Schema.decodeUnknownSync(Id("examSittings"))(id),
  opensAt: 1_799_996_400_000,
  room: name,
  state: "scheduled",
  timeZone: "Asia/Jakarta",
});

describe("the rooms table's group filter", () => {
  const lab = room("sitting-1", "Lab 1");
  const hall = room("sitting-2", "Hall", { cohortId, kind: "cohort" }, "7A");
  const lab2 = room("sitting-3", "Lab 2");

  it("keys a group by its kind and its cohort or unit", () => {
    expect(roomGroupKey({ kind: "unit", unitId })).toBe("unit:unit-smp");
    expect(roomGroupKey({ cohortId, kind: "cohort" })).toBe("cohort:cohort-7a");
  });

  it("lists each group of the loaded rooms once, in the order of its first room", () => {
    expect(roomGroups([lab, hall, lab2])).toEqual([
      { key: "unit:unit-smp", kind: "unit", name: "SMP Nakafa" },
      { key: "cohort:cohort-7a", kind: "cohort", name: "7A" },
    ]);
  });

  it("keeps every room for every group, and the rooms of one group when it is chosen", () => {
    expect(roomsOfGroup([lab, hall, lab2], "all")).toEqual([lab, hall, lab2]);
    expect(roomsOfGroup([lab, hall, lab2], "unit:unit-smp")).toEqual([
      lab,
      lab2,
    ]);
    expect(roomsOfGroup([lab, hall, lab2], "cohort:cohort-7a")).toEqual([hall]);
  });
});

describe("exams/rooms client", () => {
  it("asks for every room of the exam when the filter names every state, with no state argument", () => {
    const args = roomsArgs(input, "all");
    expect(args).toEqual(input);
    expect(args).not.toHaveProperty("state");
  });

  it("asks for the rooms of one state when the filter names it", () => {
    expect(roomsArgs(input, "open")).toEqual({ ...input, state: "open" });
  });

  it("takes a cancelled room off every loaded page of the school's rooms at once", () => {
    const pages = {
      continueCursor: "next",
      isDone: false,
      page: [room("room-a", "Lab 1"), room("room-b", "Lab 2")],
    };
    const args = { ...input, paginationOpts: { cursor: null, numItems: 20 } };
    const other = { ...args, slug: Schema.decodeSync(TenantSlug)("other") };
    const local = createLocalStore();
    local.seed(exams.rooms.list, args, pages);
    local.seed(exams.rooms.list, other, pages);
    local.seed(
      exams.rooms.list,
      { ...args, slug: Schema.decodeSync(TenantSlug)("lain") },
      undefined
    );
    cancelRoomChange(local.store, {
      sittingId: Schema.decodeUnknownSync(Id("examSittings"))("room-a"),
      slug: input.slug,
    });
    const shown = Option.getOrThrow(
      local.store.getQuery(exams.rooms.list, args)
    );
    expect(Arr.map(shown.page, (item) => item.room)).toEqual(["Lab 2"]);
    const untouched = Option.getOrThrow(
      local.store.getQuery(exams.rooms.list, other)
    );
    expect(untouched.page).toHaveLength(2);
  });
});
