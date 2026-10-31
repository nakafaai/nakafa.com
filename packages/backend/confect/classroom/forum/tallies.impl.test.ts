import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { REACTION_LIMIT } from "@repo/backend/confect/classroom/forum/tally";
import {
  denied,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { hide, send } = refs.public.classroom.forum.messages;
const { open, reply } = refs.public.classroom.forum.threads;
const { react, since, vote } = refs.public.classroom.forum.tallies;

/** A class with a teacher's message in its general channel. */
const messaged = Effect.gen(function* () {
  const fixture = yield* keyedFixture;
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  const message = yield* fixture.as("teacher").mutation(send, {
    ...forum,
    attachments: [],
    clientKey: "plain-message",
    mentions: [],
    poll: null,
    slug: nf,
    text: "Selamat pagi",
  });
  return { fixture, forum, message };
});

/** A class with a teacher's poll of three choices, one or several by `multiple`. */
const polled = (multiple: boolean) =>
  Effect.gen(function* () {
    const fixture = yield* keyedFixture;
    const term = yield* period(fixture, fixture.units.smp);
    const forum = yield* forumClass(fixture, term.id, "X-1");
    const message = yield* fixture.as("teacher").mutation(send, {
      ...forum,
      attachments: [],
      clientKey: "poll-message",
      mentions: [],
      poll: {
        multiple,
        options: ["Senin", "Selasa", "Rabu"],
        question: "Ulangan hari apa?",
      },
      slug: nf,
      text: "",
    });
    return { fixture, forum, message };
  });

describe("classroom/forum tallies", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "gives an emoji to a message, counts it for each reader, and takes it back on a second press",
    () =>
      Effect.gen(function* () {
        const { fixture, forum, message } = yield* messaged;
        const args = {
          classId: forum.classId,
          messageId: message.id,
          slug: nf,
        };
        yield* fixture.as("student").mutation(react, { ...args, emoji: "👍" });
        yield* fixture.as("teacher").mutation(react, { ...args, emoji: "👍" });
        const read = (role: "student" | "teacher") =>
          fixture.as(role).query(since, {
            classId: forum.classId,
            place: { _tag: "channel", channelId: forum.channelId },
            since: 0,
            slug: nf,
          });
        expect(yield* read("student")).toEqual([
          {
            messageId: message.id,
            reactions: [{ count: 2, emoji: "👍", mine: true }],
            votes: [],
          },
        ]);
        yield* fixture.as("student").mutation(react, { ...args, emoji: "👍" });
        const after = yield* read("student");
        expect(after[0]?.reactions).toEqual([
          { count: 1, emoji: "👍", mine: false },
        ]);
        yield* fixture.as("teacher").mutation(react, { ...args, emoji: "👍" });
        expect(yield* read("teacher")).toEqual([]);
      })
  );

  it.effect("keeps the tallies of a place to what the reader loaded", () =>
    Effect.gen(function* () {
      const { fixture, forum, message } = yield* messaged;
      yield* fixture.as("student").mutation(react, {
        classId: forum.classId,
        emoji: "🎉",
        messageId: message.id,
        slug: nf,
      });
      const listed = yield* fixture.as("student").query(since, {
        classId: forum.classId,
        place: { _tag: "channel", channelId: forum.channelId },
        since: message.createdAt + 1,
        slug: nf,
      });
      expect(listed).toEqual([]);
    })
  );

  it.effect("reads the tallies of a discussion with its opening message", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const forum = yield* forumClass(fixture, term.id, "X-1");
      const teacher = fixture.as("teacher");
      const thread = yield* teacher.mutation(open, {
        ...forum,
        clientKey: "opening-message",
        mentions: [],
        slug: nf,
        text: "Bab 1",
        title: "Bab 1",
      });
      const answer = yield* teacher.mutation(reply, {
        attachments: [],
        classId: forum.classId,
        clientKey: "first-answer",
        mentions: [],
        number: 1,
        slug: nf,
        text: "Jawaban",
      });
      const args = { classId: forum.classId, slug: nf };
      yield* fixture.as("student").mutation(react, {
        ...args,
        emoji: "❤️",
        messageId: thread.opening.id,
      });
      yield* fixture.as("student").mutation(react, {
        ...args,
        emoji: "👍",
        messageId: answer.id,
      });
      const listed = yield* fixture.as("student").query(since, {
        ...args,
        place: { _tag: "discussion", number: 1 },
        since: 0,
        slug: nf,
      });
      expect(Arr.map(listed, (tally) => tally.messageId)).toEqual([
        thread.opening.id,
        answer.id,
      ]);
    })
  );

  it.effect("stops a message at the most emoji it carries", () =>
    Effect.gen(function* () {
      const { fixture, forum, message } = yield* messaged;
      const args = { classId: forum.classId, messageId: message.id, slug: nf };
      yield* Effect.forEach(Arr.range(1, REACTION_LIMIT), (index) =>
        fixture.as("student").mutation(react, {
          ...args,
          emoji: String.fromCodePoint(0x1_f6_00 + index),
        })
      );
      const refused = yield* fixture
        .as("student")
        .mutation(react, { ...args, emoji: "🐢" })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "ReactionLimit" });
    })
  );

  it.effect(
    "refuses a reaction to a message a teacher hid, and forgets its tally",
    () =>
      Effect.gen(function* () {
        const { fixture, forum, message } = yield* messaged;
        const args = {
          classId: forum.classId,
          messageId: message.id,
          slug: nf,
        };
        yield* fixture.as("student").mutation(react, { ...args, emoji: "👍" });
        yield* fixture.as("teacher").mutation(hide, args);
        const refused = yield* fixture
          .as("student")
          .mutation(react, { ...args, emoji: "👍" })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "MessageHidden" });
        const listed = yield* fixture.as("student").query(since, {
          classId: forum.classId,
          place: { _tag: "channel", channelId: forum.channelId },
          since: 0,
          slug: nf,
        });
        expect(listed).toEqual([]);
      })
  );

  it.effect(
    "counts one choice a voter, moves it when they vote again, and takes it back on an empty vote",
    () =>
      Effect.gen(function* () {
        const { fixture, forum, message } = yield* polled(false);
        const args = {
          classId: forum.classId,
          messageId: message.id,
          slug: nf,
        };
        const student = fixture.as("student");
        const read = () =>
          student.query(since, {
            classId: forum.classId,
            place: { _tag: "channel", channelId: forum.channelId },
            since: 0,
            slug: nf,
          });
        yield* student.mutation(vote, { ...args, options: [0] });
        yield* fixture.as("teacher").mutation(vote, { ...args, options: [0] });
        const first = yield* read();
        expect(first[0]?.votes).toEqual([{ count: 2, mine: true, option: 0 }]);
        yield* student.mutation(vote, { ...args, options: [2] });
        const moved = yield* read();
        expect(moved[0]?.votes).toEqual([
          { count: 1, mine: false, option: 0 },
          { count: 1, mine: true, option: 2 },
        ]);
        yield* student.mutation(vote, { ...args, options: [] });
        const taken = yield* read();
        expect(taken[0]?.votes).toEqual([{ count: 1, mine: false, option: 0 }]);
      })
  );

  it.effect(
    "takes several choices in a poll that allows them, and refuses what a poll does not hold",
    () =>
      Effect.gen(function* () {
        const single = yield* polled(false);
        const args = {
          classId: single.forum.classId,
          messageId: single.message.id,
          slug: nf,
        };
        const failures = yield* Effect.all([
          single.fixture
            .as("student")
            .mutation(vote, { ...args, options: [0, 1] })
            .pipe(Effect.flip),
          single.fixture
            .as("student")
            .mutation(vote, { ...args, options: [3] })
            .pipe(Effect.flip),
        ]);
        expect(failures).toMatchObject([
          { _tag: "VoteRefused" },
          { _tag: "VoteRefused" },
        ]);
        const several = yield* polled(true);
        yield* several.fixture.as("student").mutation(vote, {
          classId: several.forum.classId,
          messageId: several.message.id,
          options: [0, 1, 1],
          slug: nf,
        });
        const listed = yield* several.fixture.as("student").query(since, {
          classId: several.forum.classId,
          place: { _tag: "channel", channelId: several.forum.channelId },
          since: 0,
          slug: nf,
        });
        expect(listed[0]?.votes).toEqual([
          { count: 1, mine: true, option: 0 },
          { count: 1, mine: true, option: 1 },
        ]);
      })
  );

  it.effect(
    "refuses a vote on a message without a poll as a missing object",
    () =>
      Effect.gen(function* () {
        const { fixture, forum, message } = yield* messaged;
        const refused = yield* fixture
          .as("student")
          .mutation(vote, {
            classId: forum.classId,
            messageId: message.id,
            options: [0],
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("resource"));
      })
  );

  it.effect(
    "shows a poll's words to its readers, and drops them with a hide",
    () =>
      Effect.gen(function* () {
        const { fixture, forum, message } = yield* polled(true);
        expect(message.poll).toEqual({
          multiple: true,
          options: ["Senin", "Selasa", "Rabu"],
          question: "Ulangan hari apa?",
        });
        const hidden = yield* fixture.as("teacher").mutation(hide, {
          classId: forum.classId,
          messageId: message.id,
          slug: nf,
        });
        expect(hidden.poll).toBeNull();
        expect(hidden.text).toBeNull();
      })
  );
});
