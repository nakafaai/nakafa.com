import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { ChannelView } from "@repo/backend/confect/classroom/forum/channel";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import {
  archiveChannelUpdate,
  removeChannelUpdate,
} from "@/components/tenant/classes/forum/archive";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const classId = Schema.decodeUnknownSync(Id("classes"))("class-1");
const channelOf = Schema.decodeUnknownSync(Id("classroomChannels"));

/** A topic channel of the class. */
const channel = (id: string): typeof ChannelView.Type => ({
  archived: false,
  id: channelOf(id),
  kind: "topic",
  last: null,
  name: id,
  unread: false,
});

const tugas = channel("tugas");
const ujian = channel("ujian");
const args = { classId, slug };
const page = { isDone: true, page: [tugas] };

/** A store with a page that holds the first channel, one that holds neither, and a read that has not arrived. */
const storeOf = () => {
  const getAllQueries = vi.fn();
  getAllQueries.mockReturnValue([
    { args, value: Option.some(page) },
    { args, value: Option.some({ isDone: true, page: [ujian] }) },
    { args, value: Option.none() },
  ]);
  const setQuery = vi.fn();
  return {
    localStore: { getAllQueries, getQuery: vi.fn(), setQuery },
    setQuery,
  };
};

describe("forum channel archive updates", () => {
  it("marks a channel archived and takes a removed one away, in the page that holds it", () => {
    const archiving = storeOf();
    archiveChannelUpdate(archiving.localStore, {
      ...args,
      archived: true,
      channelId: tugas.id,
    });
    expect(archiving.setQuery.mock.calls).toEqual([
      [
        classroom.forum.channels.list,
        args,
        Option.some({ ...page, page: [{ ...tugas, archived: true }] }),
      ],
    ]);

    const removing = storeOf();
    removeChannelUpdate(removing.localStore, { ...args, channelId: tugas.id });
    expect(removing.setQuery.mock.calls).toEqual([
      [classroom.forum.channels.list, args, Option.some({ ...page, page: [] })],
    ]);
  });

  it("leaves the other channels of a page as they were", () => {
    const { localStore, setQuery } = storeOf();
    localStore.getAllQueries.mockReturnValue([
      { args, value: Option.some({ isDone: true, page: [tugas, ujian] }) },
    ]);
    archiveChannelUpdate(localStore, {
      ...args,
      archived: true,
      channelId: tugas.id,
    });
    expect(setQuery.mock.calls[0]?.[2]).toEqual(
      Option.some({
        isDone: true,
        page: [{ ...tugas, archived: true }, ujian],
      })
    );
  });
});
