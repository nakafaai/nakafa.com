import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import {
  editUpdate,
  type ForumMessage,
  hideUpdate,
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
  createdAt: 1,
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
