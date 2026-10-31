import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";
import {
  renameChannelUpdate,
  renameDiscussionUpdate,
} from "@/components/tenant/classes/forum/rename";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const classId = Schema.decodeUnknownSync(Id("classes"))("class-1");
const channelOf = Schema.decodeUnknownSync(Id("classroomChannels"));
const general = channelOf("general");
const topic = channelOf("topic");

/** A store that answers each ref with its own rows, and records what is written. */
const storeByRef = (queries: readonly (readonly [unknown, unknown[]])[]) => {
  const getAllQueries = vi.fn();
  getAllQueries.mockImplementation((ref: unknown) =>
    Option.getOrElse(
      Option.map(
        Arr.findFirst(queries, ([key]) => key === ref),
        ([, rows]) => rows
      ),
      () => []
    )
  );
  const setQuery = vi.fn();
  return {
    localStore: { getAllQueries, getQuery: vi.fn(), setQuery },
    setQuery,
  };
};

/** A topic channel as the list shows it. */
const channel = (id: typeof general, name: string) => ({
  id,
  kind: "topic" as const,
  name,
  unread: false,
});

describe("renameChannelUpdate", () => {
  it("shows the new name in the pages that list the channel, and leaves the others alone", () => {
    const args = { classId, slug };
    const { localStore, setQuery } = storeByRef([
      [
        classroom.forum.channels.list,
        [
          {
            args,
            value: Option.some({
              isDone: true,
              page: [channel(general, "Umum"), channel(topic, "Tugas")],
            }),
          },
          {
            args,
            value: Option.some({
              isDone: true,
              page: [channel(general, "Umum")],
            }),
          },
          { args, value: Option.none() },
        ],
      ],
    ]);
    renameChannelUpdate(localStore, {
      ...args,
      channelId: topic,
      name: "Tugas rumah",
    });
    expect(setQuery.mock.calls).toEqual([
      [
        classroom.forum.channels.list,
        args,
        Option.some({
          isDone: true,
          page: [channel(general, "Umum"), channel(topic, "Tugas rumah")],
        }),
      ],
    ]);
  });
});

describe("renameDiscussionUpdate", () => {
  it("shows the new title on the discussion's page and on its opening message", () => {
    const summary = { number: 1, title: "Judul lama" };
    const args = { classId, number: 1, slug };
    const page = { channelId: general, classId, slug };
    const renamed = { number: 1, title: "Judul baru" };
    const { localStore, setQuery } = storeByRef([
      [
        classroom.forum.threads.get,
        [{ args, value: Option.some({ discussion: summary }) }],
      ],
      [
        classroom.forum.messages.page,
        [
          {
            args: page,
            value: Option.some({ page: [{ discussion: summary, id: "m" }] }),
          },
        ],
      ],
    ]);
    renameDiscussionUpdate(localStore, { ...args, title: "Judul baru" });
    expect(setQuery.mock.calls).toEqual([
      [
        classroom.forum.threads.get,
        args,
        Option.some({ discussion: renamed }),
      ],
      [
        classroom.forum.messages.page,
        page,
        Option.some({ page: [{ discussion: renamed, id: "m" }] }),
      ],
    ]);
  });
});
