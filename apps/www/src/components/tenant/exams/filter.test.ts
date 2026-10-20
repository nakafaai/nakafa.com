import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { RoomRow } from "@repo/backend/confect/exams/rooms";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";
import {
  cancelRoomChange,
  roomsArgs,
} from "@/components/tenant/exams/filter";
import { createLocalStore } from "@/test/optimistic";

const input = {
  examId: Schema.decodeUnknownSync(Id("exams"))("exam-pts"),
  slug: Schema.decodeSync(TenantSlug)("nf"),
};

/** One scheduled room of the exam, as the rooms list shows it. */
const room = (id: string, name: string): typeof RoomRow.Type => ({
  canCancel: false,
  closesAt: 1_800_000_000_000,
  group: { kind: "unit", name: "SMP Nakafa" },
  id: Schema.decodeUnknownSync(Id("examSittings"))(id),
  opensAt: 1_799_996_400_000,
  room: name,
  state: "scheduled",
  timeZone: "Asia/Jakarta",
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
