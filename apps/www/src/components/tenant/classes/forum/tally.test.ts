import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Option, Schema } from "effect";
import {
  type ForumTally,
  reactUpdate,
  shareOf,
  voteUpdate,
} from "@/components/tenant/classes/forum/tally";

const classId = Schema.decodeUnknownSync(Id("classes"))("class-1");
const messageId = Schema.decodeUnknownSync(Id("classroomMessages"))(
  "message-1"
);
const other = Schema.decodeUnknownSync(Id("classroomMessages"))("message-2");
const slug = "sekolah" as never;

/** Applies an update to one held read of the tallies, and answers what the store holds then. */
const applied = (
  update: (store: never, args: never) => void,
  held: readonly ForumTally[],
  args: object
) => {
  const setQuery = vi.fn();
  const store = {
    getAllQueries: () => [
      { args: { classId }, value: Option.some(held) },
      { args: { classId: "other" }, value: Option.some(held) },
      { args: { classId }, value: Option.none() },
    ],
    setQuery,
  };
  update(store as never, { classId, messageId, slug, ...args } as never);
  expect(setQuery).toHaveBeenCalledTimes(1);
  return Option.getOrThrow(setQuery.mock.calls[0]?.[2]);
};

describe("reactUpdate", () => {
  it("adds the viewer's new emoji, and a tally for a message that held none", () => {
    expect(applied(reactUpdate, [], { emoji: "👍" })).toEqual([
      {
        messageId,
        reactions: [{ count: 1, emoji: "👍", mine: true }],
        votes: [],
      },
    ]);
  });

  it("joins an emoji others gave, takes the viewer's own back, and keeps other messages", () => {
    const held: readonly ForumTally[] = [
      {
        messageId,
        reactions: [
          { count: 2, emoji: "👍", mine: false },
          { count: 1, emoji: "❤️", mine: true },
        ],
        votes: [],
      },
      { messageId: other, reactions: [], votes: [] },
    ];
    expect(applied(reactUpdate, held, { emoji: "👍" })).toEqual([
      { messageId: other, reactions: [], votes: [] },
      {
        messageId,
        reactions: [
          { count: 3, emoji: "👍", mine: true },
          { count: 1, emoji: "❤️", mine: true },
        ],
        votes: [],
      },
    ]);
    expect(applied(reactUpdate, held, { emoji: "❤️" })).toEqual([
      { messageId: other, reactions: [], votes: [] },
      {
        messageId,
        reactions: [{ count: 2, emoji: "👍", mine: false }],
        votes: [],
      },
    ]);
  });

  it("drops a tally once nothing stands in it", () => {
    const held: readonly ForumTally[] = [
      {
        messageId,
        reactions: [{ count: 1, emoji: "👍", mine: true }],
        votes: [],
      },
    ];
    expect(applied(reactUpdate, held, { emoji: "👍" })).toEqual([]);
  });
});

describe("voteUpdate", () => {
  it("moves the viewer's vote to the new choice, and a new choice takes its first vote", () => {
    const held: readonly ForumTally[] = [
      {
        messageId,
        reactions: [],
        votes: [
          { count: 2, mine: true, option: 0 },
          { count: 1, mine: false, option: 1 },
          { count: 1, mine: true, option: 3 },
        ],
      },
    ];
    expect(applied(voteUpdate, held, { options: [1, 2] })).toEqual([
      {
        messageId,
        reactions: [],
        votes: [
          { count: 1, mine: false, option: 0 },
          { count: 2, mine: true, option: 1 },
          { count: 1, mine: true, option: 2 },
        ],
      },
    ]);
  });
});

describe("shareOf", () => {
  it("reads a choice's share of every vote as a whole percent, and none before a vote", () => {
    expect(shareOf(1, 3)).toBe(33);
    expect(shareOf(0, 0)).toBe(0);
  });
});
