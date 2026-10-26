import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Option, Schema } from "effect";
import {
  editUpdate,
  type ForumMessage,
  hideUpdate,
  markUpdate,
  openUpdate,
  replyUpdate,
  sendUpdate,
} from "@/components/tenant/classes/forum/optimistic";

const slug = Schema.decodeSync(TenantSlug)("sekolah");
const classId = Schema.decodeUnknownSync(Id("classes"))("class-1");
const channelOf = Schema.decodeUnknownSync(Id("classroomChannels"));
const messageOf = Schema.decodeUnknownSync(Id("classroomMessages"));
const personId = Schema.decodeUnknownSync(Id("tenantPeople"))("person-1");
const general = channelOf("general");
const topic = channelOf("topic");

/** A message of the channel, written by the viewer. */
const message = (id: string, text: string): ForumMessage => ({
  author: { id: personId, name: "Bu Rina" },
  clientKey: `key-${id}-0000`,
  createdAt: 1,
  discussion: null,
  editedAt: null,
  id: messageOf(id),
  mine: true,
  text,
});

/** The arguments of one page of a channel's messages. */
const pageArgs = (channelId: typeof general, cursor: string | null) => ({
  channelId,
  classId,
  paginationOpts: { cursor, numItems: 30 },
  slug,
});

/** A store that holds the given pages, each with its arguments, and records what is written. */
const storeOf = (pages: unknown[]) => {
  const getAllQueries = vi.fn();
  getAllQueries.mockReturnValue(pages);
  const setQuery = vi.fn();
  return {
    localStore: { getAllQueries, getQuery: vi.fn(), setQuery },
    setQuery,
  };
};

describe("sendUpdate", () => {
  it("shows a sent message first in the newest page of its own channel only", () => {
    const old = message("old", "Halo");
    const sent = message("sent", "Tugas dikumpulkan Jumat.");
    const { localStore, setQuery } = storeOf([
      {
        args: pageArgs(general, null),
        value: Option.some({ isDone: false, page: [old] }),
      },
      {
        args: pageArgs(general, "older"),
        value: Option.some({ isDone: true, page: [] }),
      },
      {
        args: pageArgs(topic, null),
        value: Option.some({ isDone: true, page: [] }),
      },
      { args: pageArgs(general, null), value: Option.none() },
    ]);

    sendUpdate(sent)(localStore, {
      channelId: general,
      classId,
      clientKey: "client-key-1",
      slug,
      text: sent.text ?? "",
    });

    expect(setQuery).toHaveBeenCalledTimes(1);
    expect(setQuery).toHaveBeenCalledWith(
      classroom.forum.messages.page,
      pageArgs(general, null),
      Option.some({ isDone: false, page: [sent, old] })
    );
  });
});

describe("editUpdate and hideUpdate", () => {
  it("change the one message in the page that holds it, and leave other pages alone", () => {
    const first = message("first", "Halo");
    const second = message("second", "Apa kabar?");
    const pages = [
      {
        args: pageArgs(general, null),
        value: Option.some({ isDone: false, page: [first, second] }),
      },
      {
        args: pageArgs(general, "older"),
        value: Option.some({ isDone: true, page: [message("x", "Lama")] }),
      },
      { args: pageArgs(general, null), value: Option.none() },
    ];
    const edited = storeOf(pages);
    editUpdate(5000)(edited.localStore, {
      classId,
      messageId: first.id,
      slug,
      text: "Halo semua",
    });
    expect(edited.setQuery).toHaveBeenCalledTimes(1);
    expect(edited.setQuery).toHaveBeenCalledWith(
      classroom.forum.messages.page,
      pageArgs(general, null),
      Option.some({
        isDone: false,
        page: [{ ...first, editedAt: 5000, text: "Halo semua" }, second],
      })
    );

    const hidden = storeOf(pages);
    hideUpdate(hidden.localStore, { classId, messageId: second.id, slug });
    expect(hidden.setQuery).toHaveBeenCalledWith(
      classroom.forum.messages.page,
      pageArgs(general, null),
      Option.some({ isDone: false, page: [first, { ...second, text: null }] })
    );
  });
});

/** A store that holds the given queries of each reference, as pairs, and records what is written. */
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

/** The summary of discussion `number`, with `replies` replies, the newest at `lastReplyAt`. */
const summary = (
  number: number,
  replies: number,
  lastReplyAt: number | null
) => ({
  lastReplyAt,
  number,
  replies,
  title: `Diskusi ${number}`,
  unread: true,
});

/** A message that opens discussion `number`. */
const opening = (id: string, number: number): ForumMessage => ({
  ...message(id, "Pembuka"),
  discussion: summary(number, 1, 10),
});

/** The arguments of one page of a discussion's replies. */
const repliesArgs = (number: number, cursor: string | null) => ({
  classId,
  number,
  paginationOpts: { cursor, numItems: 30 },
  slug,
});

/** One discussion as its own page shows it. */
const thread = (number: number) => ({
  channelId: general,
  discussion: summary(number, 1, 10),
  id: Schema.decodeUnknownSync(Id("classroomThreads"))(`thread-${number}`),
  opening: opening(`opening-${number}`, number),
});

describe("openUpdate", () => {
  it("shows the message that opens a discussion first in the newest page of its channel", () => {
    const old = message("old", "Halo");
    const opened = opening("opened", 1);
    const { localStore, setQuery } = storeOf([
      {
        args: pageArgs(general, null),
        value: Option.some({ isDone: true, page: [old] }),
      },
    ]);

    openUpdate(opened)(localStore, {
      channelId: general,
      classId,
      clientKey: "client-key-2",
      slug,
      text: "Pembuka",
      title: "Diskusi 1",
    });

    expect(setQuery).toHaveBeenCalledWith(
      classroom.forum.messages.page,
      pageArgs(general, null),
      Option.some({ isDone: true, page: [opened, old] })
    );
  });
});

describe("replyUpdate", () => {
  it("shows a reply in its own discussion and counts it wherever the discussion shows", () => {
    const sent = { ...message("reply", "Balasan"), createdAt: 50 };
    const other = opening("other", 2);
    const own = opening("own", 1);
    const plain = message("plain", "Biasa");
    const { localStore, setQuery } = storeByRef([
      [
        classroom.forum.threads.replies,
        [
          {
            args: repliesArgs(1, null),
            value: Option.some({ isDone: true, page: [] }),
          },
          {
            args: repliesArgs(1, "older"),
            value: Option.some({ isDone: true, page: [] }),
          },
          {
            args: repliesArgs(2, null),
            value: Option.some({ isDone: true, page: [] }),
          },
          { args: repliesArgs(1, null), value: Option.none() },
        ],
      ],
      [
        classroom.forum.threads.get,
        [
          {
            args: { classId, number: 1, slug },
            value: Option.some(thread(1)),
          },
          {
            args: { classId, number: 2, slug },
            value: Option.some(thread(2)),
          },
          { args: { classId, number: 1, slug }, value: Option.none() },
        ],
      ],
      [
        classroom.forum.messages.page,
        [
          {
            args: pageArgs(general, null),
            value: Option.some({ isDone: true, page: [plain, own, other] }),
          },
          {
            args: pageArgs(topic, null),
            value: Option.some({ isDone: true, page: [plain] }),
          },
          { args: pageArgs(general, null), value: Option.none() },
        ],
      ],
    ]);

    replyUpdate(sent)(localStore, {
      classId,
      clientKey: "client-key-3",
      number: 1,
      slug,
      text: "Balasan",
    });

    const counted = { ...summary(1, 2, 50), unread: false };
    expect(setQuery.mock.calls).toEqual([
      [
        classroom.forum.threads.replies,
        repliesArgs(1, null),
        Option.some({ isDone: true, page: [sent] }),
      ],
      [
        classroom.forum.threads.get,
        { classId, number: 1, slug },
        Option.some({ ...thread(1), discussion: counted }),
      ],
      [
        classroom.forum.messages.page,
        pageArgs(general, null),
        Option.some({
          isDone: true,
          page: [plain, { ...own, discussion: counted }, other],
        }),
      ],
    ]);
  });
});

describe("markUpdate", () => {
  it("moves the read mark of the channel forward and clears its unread dot", () => {
    const place = { _tag: "channel" as const, channelId: general };
    const elsewhere = { _tag: "channel" as const, channelId: topic };
    const channel = (id: typeof general, unread: boolean) => ({
      id,
      kind: "topic" as const,
      name: "Kanal",
      unread,
    });
    const { localStore, setQuery } = storeByRef([
      [
        classroom.forum.reads.get,
        [
          { args: { classId, place, slug }, value: Option.some({ at: 100 }) },
          { args: { classId, place, slug }, value: Option.some({ at: 900 }) },
          {
            args: { classId, place, slug },
            value: Option.some({ at: null }),
          },
          {
            args: { classId, place: elsewhere, slug },
            value: Option.some({ at: 1 }),
          },
          { args: { classId, place, slug }, value: Option.none() },
        ],
      ],
      [
        classroom.forum.channels.list,
        [
          {
            args: { classId, slug },
            value: Option.some({
              isDone: true,
              page: [channel(general, true), channel(topic, true)],
            }),
          },
          {
            args: { classId, slug },
            value: Option.some({
              isDone: true,
              page: [channel(topic, true)],
            }),
          },
          { args: { classId, slug }, value: Option.none() },
        ],
      ],
    ]);

    markUpdate(localStore, { at: 500, classId, place, slug });

    expect(setQuery.mock.calls).toEqual([
      [
        classroom.forum.reads.get,
        { classId, place, slug },
        Option.some({ at: 500 }),
      ],
      [
        classroom.forum.reads.get,
        { classId, place, slug },
        Option.some({ at: 900 }),
      ],
      [
        classroom.forum.reads.get,
        { classId, place, slug },
        Option.some({ at: 500 }),
      ],
      [
        classroom.forum.channels.list,
        { classId, slug },
        Option.some({
          isDone: true,
          page: [channel(general, false), channel(topic, true)],
        }),
      ],
    ]);
  });

  it("clears the unread dot of a discussion only up to its newest reply", () => {
    const own = opening("own", 1);
    const { localStore, setQuery } = storeByRef([
      [
        classroom.forum.messages.page,
        [
          {
            args: pageArgs(general, null),
            value: Option.some({ isDone: true, page: [own] }),
          },
        ],
      ],
    ]);
    const place = { _tag: "discussion" as const, number: 1 };

    markUpdate(localStore, { at: 5, classId, place, slug });
    markUpdate(localStore, { at: 10, classId, place, slug });

    expect(setQuery.mock.calls).toEqual([
      [
        classroom.forum.messages.page,
        pageArgs(general, null),
        Option.some({ isDone: true, page: [own] }),
      ],
      [
        classroom.forum.messages.page,
        pageArgs(general, null),
        Option.some({
          isDone: true,
          page: [
            { ...own, discussion: { ...summary(1, 1, 10), unread: false } },
          ],
        }),
      ],
    ]);
  });
});
