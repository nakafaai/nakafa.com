import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Array as Arr, Option, Schema } from "effect";
import {
  firstUnread,
  headToKeep,
  isPending,
  newestSeen,
  opensRun,
} from "@/components/tenant/classes/forum/marks";
import type { ForumMessage } from "@/components/tenant/classes/forum/optimistic";

const personId = Schema.decodeUnknownSync(Id("tenantPeople"))("person-1");
const messageOf = Schema.decodeUnknownSync(Id("classroomMessages"));

/** A message of the forum, saved unless `pending`, written at `createdAt` by the viewer when `mine`. */
const message = (
  key: string,
  createdAt: number,
  mine = false,
  pending = false
): ForumMessage => ({
  author: { id: personId, name: "Raka" },
  clientKey: key,
  createdAt,
  discussion: null,
  editedAt: null,
  mentions: [],
  id: messageOf(pending ? key : `saved-${key}`),
  mine,
  text: "Halo",
});

const messages = [
  message("first", 1000),
  message("own", 2000, true),
  message("second", 3000),
  message("draft", 4000, true, true),
];

describe("forum read marks", () => {
  it("finds the first message of another member after the mark, and none for a place never read", () => {
    expect(firstUnread(messages, 1000)).toEqual(Option.some("second"));
    expect(firstUnread(messages, 0)).toEqual(Option.some("first"));
    expect(firstUnread(messages, 3000)).toEqual(Option.none());
    expect(firstUnread(messages, null)).toEqual(Option.none());
  });

  it("reads the newest saved message in view, and nothing when none is in view", () => {
    expect(newestSeen(messages, ["first", "second", "draft"])).toEqual(
      Option.some(3000)
    );
    expect(newestSeen(messages, ["draft"])).toEqual(Option.none());
    expect(newestSeen(messages, [])).toEqual(Option.none());
  });

  it("tells a message the server is still saving by its client key", () => {
    expect(isPending(message("draft", 1, true, true))).toBe(true);
    expect(isPending(message("saved", 1))).toBe(false);
  });

  it("keeps the author line of the oldest loaded message while older history may load, once", () => {
    expect(headToKeep(messages, true, [])).toEqual(Option.some("first"));
    expect(headToKeep(messages, true, ["first"])).toEqual(Option.none());
    expect(headToKeep(messages, false, [])).toEqual(Option.none());
    expect(headToKeep([], true, [])).toEqual(Option.none());
  });

  it("opens an author's run at the oldest message, after another author, and where a line was kept", () => {
    const other = {
      ...message("other", 2500),
      author: {
        id: Schema.decodeUnknownSync(Id("tenantPeople"))("person-2"),
        name: "Nadia",
      },
    };
    const run = [
      message("older", 500),
      message("first", 1000),
      other,
      message("second", 3000),
    ];
    expect(Arr.map(run, (_, index) => opensRun(run, index, []))).toEqual([
      true,
      false,
      true,
      true,
    ]);
    expect(opensRun(run, 1, ["first"])).toBe(true);
  });
});
