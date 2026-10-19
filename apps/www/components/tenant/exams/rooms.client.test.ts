import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { RoomRow } from "@repo/backend/confect/exams/rooms";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import {
  insertPlaceholderRoom,
  roomsArgs,
} from "@/components/tenant/exams/rooms.client";

/** One room of the rooms list. */
type Room = typeof RoomRow.Type;

const input = {
  examId: Schema.decodeUnknownSync(Id("exams"))("exam-pts"),
  slug: Schema.decodeSync(TenantSlug)("nf"),
};

describe("exams/rooms client", () => {
  it("asks for every room of the exam when the filter names every state, with no state argument", () => {
    const args = roomsArgs(input, "all");
    expect(args).toEqual(input);
    expect(args).not.toHaveProperty("state");
  });

  it("asks for the rooms of one state when the filter names it", () => {
    expect(roomsArgs(input, "open")).toEqual({ ...input, state: "open" });
  });
});

describe("insertPlaceholderRoom", () => {
  const sittingId = Schema.decodeUnknownSync(Id("examSittings"));
  const unitId = Schema.decodeUnknownSync(Id("tenantUnits"));
  const row = (id: string, opensAt: number): Room => ({
    closesAt: opensAt + 60_000,
    group: { kind: "unit", name: "Kelas 10" },
    id: sittingId(id),
    opensAt,
    room: id,
    state: "scheduled",
    timeZone: "Asia/Jakarta",
  });
  const page = (state: string | undefined, cursor: string | null) => ({
    args: {
      ...input,
      ...(state === undefined ? {} : { state }),
      paginationOpts: { cursor, numItems: 20 },
    },
    value: Option.some({ isDone: true, page: [row("ruang-b", 2_000_000)] }),
  });
  const insertion: Room = {
    closesAt: 1_000_060_000,
    group: { kind: "unit", name: "Kelas 10" },
    id: sittingId("ruang-baru"),
    opensAt: 1_000_000,
    room: "Ruang baru",
    state: "scheduled",
    timeZone: "Asia/Jakarta",
  };
  // The schedule's arguments are written at each call, so the group keeps its literal kind.
  const scheduleArgs = {
    closesAt: insertion.closesAt,
    examId: input.examId,
    opensAt: insertion.opensAt,
    room: insertion.room,
    slug: input.slug,
  };

  it("shows the room first at its opening in each first page of the exam's rooms", () => {
    const getAllQueries = vi
      .fn()
      .mockReturnValue([page(undefined, null), page("scheduled", null)]);
    const setQuery = vi.fn();

    insertPlaceholderRoom(insertion)(
      { getAllQueries, getQuery: vi.fn(), setQuery },
      { ...scheduleArgs, group: { kind: "unit", unitId: unitId("unit") } }
    );

    expect(setQuery).toHaveBeenCalledTimes(2);
    expect(setQuery).toHaveBeenCalledWith(
      exams.rooms.list,
      page(undefined, null).args,
      Option.some({
        isDone: true,
        page: [insertion, row("ruang-b", 2_000_000)],
      })
    );
  });

  it("leaves the filter that names another state, and every later page, as they are", () => {
    const getAllQueries = vi
      .fn()
      .mockReturnValue([page("open", null), page(undefined, "next")]);
    const setQuery = vi.fn();

    insertPlaceholderRoom(insertion)(
      { getAllQueries, getQuery: vi.fn(), setQuery },
      { ...scheduleArgs, group: { kind: "unit", unitId: unitId("unit") } }
    );

    expect(setQuery).not.toHaveBeenCalled();
  });
});
