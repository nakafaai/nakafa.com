import { Ref } from "@confect/core";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Equal, MutableRef, Option, Schema } from "effect";
import {
  type ForumTally,
  reactUpdate,
  shareOf,
  voteUpdate,
} from "@/components/tenant/classes/forum/tally";

const CLASS = "class-1";
const classId = Schema.decodeUnknownSync(Id("classes"))(CLASS);
const messageId = Schema.decodeUnknownSync(Id("classroomMessages"))(
  "message-1"
);
const other = Schema.decodeUnknownSync(Id("classroomMessages"))("message-2");
const slug = Schema.decodeSync(TenantSlug)("sekolah");
const { since } = classroom.forum.tallies;

/** One read the store holds: its arguments, and its answer once it came. */
type Cached = readonly [unknown, unknown];

/** The arguments of a place's read of the tallies, for a class. */
const sinceArgs = (id: string) => ({
  classId: id,
  place: { _tag: "channel", channelId: "general" },
  since: 0,
  slug: "sekolah",
});

/**
 * A store with the reads a page holds: this class's, another class's, and one still loading. It
 * encodes and decodes with the schemas of the function, like Confect's own store.
 */
function fakeStore(held: readonly ForumTally[]) {
  const cache = MutableRef.make<readonly Cached[]>([
    [sinceArgs(CLASS), Ref.encodeReturnsSync(since, held)],
    [sinceArgs("class-2"), []],
    [{ ...sinceArgs(CLASS), since: 1 }, undefined],
  ]);
  const store: OptimisticLocalStore.OptimisticLocalStore = {
    getAllQueries: (ref) =>
      Arr.map(MutableRef.get(cache), ([args, value]) => ({
        args: Ref.decodeArgsSync(ref, args),
        value:
          value === undefined
            ? Option.none()
            : Option.some(Ref.decodeReturnsSync(ref, value)),
      })),
    getQuery: () => Option.none(),
    setQuery: (ref, args, value) => {
      const encoded = Ref.encodeArgsSync(ref, args);
      const next: Cached = [
        encoded,
        Option.isSome(value)
          ? Ref.encodeReturnsSync(ref, value.value)
          : undefined,
      ];
      MutableRef.update(cache, (current) =>
        Arr.map(current, (entry) =>
          Equal.equals(entry[0], encoded) ? next : entry
        )
      );
    },
  };
  return { answer: () => Arr.getUnsafe(MutableRef.get(cache), 0)[1], store };
}

/** What this class's read holds after the viewer presses an emoji. */
const afterReact = (held: readonly ForumTally[], emoji: string) => {
  const fake = fakeStore(held);
  reactUpdate(fake.store, { classId, emoji, messageId, slug });
  return fake.answer();
};

/** What this class's read holds after the viewer votes. */
const afterVote = (held: readonly ForumTally[], options: readonly number[]) => {
  const fake = fakeStore(held);
  voteUpdate(fake.store, { classId, messageId, options, slug });
  return fake.answer();
};

describe("reactUpdate", () => {
  it("adds the viewer's new emoji, and a tally for a message that held none", () => {
    expect(afterReact([], "👍")).toEqual([
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
    expect(afterReact(held, "👍")).toEqual([
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
    expect(afterReact(held, "❤️")).toEqual([
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
    expect(afterReact(held, "👍")).toEqual([]);
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
    expect(afterVote(held, [1, 2])).toEqual([
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
