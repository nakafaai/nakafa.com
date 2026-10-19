import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import {
  insertPlaceholderRoom,
  roomsArgs,
} from "@/components/tenant/exams/rooms.client";

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
  const row = (id: string, opensAt: number) => ({
    closesAt: opensAt + 60_000,
    group: { kind: "unit" as const, name: "Kelas 10" },
    id: sittingId(id),
    opensAt,
    room: id,
    state: "scheduled" as const,
    timeZone: "Asia/Jakarta",
  });
  const first = (queryArgs: object) => ({
    args: {
      ...input,
      ...queryArgs,
      paginationOpts: { cursor: null, numItems: 20 },
    },
    value: Option.some({ isDone: true, page: [row("ruang-b", 2_000_000)] }),
  });
  const insertionRow = {
    closesAt: 1_000_060_000,
    group: { kind: "unit" as const, name: "Kelas 10" },
    id: sittingId("ruang-baru"),
    opensAt: 1_000_000,
    room: "Ruang baru",
    state: "scheduled" as const,
    timeZone: "Asia/Jakarta",
  };
  const schedule = {
    closesAt: insertionRow.closesAt,
    examId: input.examId,
    group: { kind: "unit" as const, unitId: "unit" as never },
    opensAt: insertionRow.opensAt,
    room: insertionRow.room,
    slug: input.slug,
  };

  it("shows the room first at its opening in each first page of the exam's rooms", () => {
    const getAllQueries = vi
      .fn()
      .mockReturnValue([first({}), first({ state: "scheduled" })]);
    const setQuery = vi.fn();

    insertPlaceholderRoom(insertionRow)(
      { getAllQueries, getQuery: vi.fn(), setQuery } as never,
      schedule as never
    );

    expect(setQuery).toHaveBeenCalledTimes(2);
    expect(setQuery).toHaveBeenCalledWith(
      exams.rooms.list,
      first({}).args,
      Option.some({
        isDone: true,
        page: [
          { ...insertionRow, id: sittingId("ruang-baru") },
          row("ruang-b", 2_000_000),
        ],
      })
    );
  });

  it("leaves the filter that names another state, and every later page, as they are", () => {
    const getAllQueries = vi.fn().mockReturnValue([
      first({ state: "open" }),
      {
        ...first({}),
        args: {
          ...first({}).args,
          paginationOpts: { cursor: "next", numItems: 20 },
        },
      },
    ]);
    const setQuery = vi.fn();

    insertPlaceholderRoom(insertionRow)(
      { getAllQueries, getQuery: vi.fn(), setQuery } as never,
      schedule as never
    );

    expect(setQuery).not.toHaveBeenCalled();
  });
});
