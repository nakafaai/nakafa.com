import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  denied,
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { add, archive, list, remove } = refs.public.classroom.forum.channels;
const { edit, send } = refs.public.classroom.forum.messages;
const { open, reply, start } = refs.public.classroom.forum.threads;
const { react, vote } = refs.public.classroom.forum.tallies;
const { mark } = refs.public.classroom.forum.reads;

/** A class with a topic channel that holds a teacher's message and poll. */
const topic = Effect.gen(function* () {
  const fixture = yield* keyedFixture;
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  const teacher = fixture.as("teacher");
  const channel = yield* teacher.mutation(add, {
    classId: forum.classId,
    name: "Tugas",
    slug: nf,
  });
  const scope = { channelId: channel.id, classId: forum.classId, slug: nf };
  const note = {
    ...scope,
    attachments: [],
    mentions: [],
    poll: null,
  };
  const message = yield* teacher.mutation(send, {
    ...note,
    clientKey: "first-message",
    text: "Selamat pagi",
  });
  const poll = yield* teacher.mutation(send, {
    ...note,
    clientKey: "poll-message",
    poll: { multiple: false, options: ["Senin", "Selasa"], question: "Hari?" },
    text: "",
  });
  return { fixture, forum, message, note, poll, scope, teacher, term };
});

/** How many rows of a forum table the school holds. */
const rowsOf = (
  table: "classroomMessages" | "classroomReads" | "classroomThreads"
) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table(table)
      .index("by_creation_time")
      .take(200)
      .pipe(Effect.map((rows) => rows.length))
  );

describe("classroom/forum channel archive and removal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "keeps an archived channel readable, refuses every write into it, and takes writes again once it is back",
    () =>
      Effect.gen(function* () {
        const { fixture, message, note, poll, scope, teacher } = yield* topic;
        const { number } = yield* teacher.mutation(start, {
          classId: scope.classId,
          messageId: message.id,
          slug: nf,
        });
        expect(
          yield* teacher.mutation(archive, { ...scope, archived: true })
        ).toBeNull();
        const listed = yield* fixture.as("student").query(list, {
          ...firstPage,
          classId: scope.classId,
          slug: nf,
        });
        expect(Arr.map(listed.page, (found) => found.archived)).toEqual([
          false,
          true,
        ]);

        const student = fixture.as("student");
        const onMessage = { classId: scope.classId, slug: nf };
        const refusals = yield* Effect.all([
          teacher
            .mutation(send, {
              ...note,
              clientKey: "late-message",
              text: "Lagi",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(edit, {
              ...onMessage,
              messageId: message.id,
              text: "Ubah",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(open, {
              ...scope,
              clientKey: "late-thread",
              mentions: [],
              text: "Baru",
              title: "Baru",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(reply, {
              ...onMessage,
              attachments: [],
              clientKey: "late-reply",
              mentions: [],
              number,
              text: "Balas",
            })
            .pipe(Effect.flip),
          teacher
            .mutation(start, { ...onMessage, messageId: poll.id })
            .pipe(Effect.flip),
          student
            .mutation(react, {
              ...onMessage,
              emoji: "👍",
              messageId: message.id,
            })
            .pipe(Effect.flip),
          student
            .mutation(vote, { ...onMessage, messageId: poll.id, options: [0] })
            .pipe(Effect.flip),
        ]);
        expect(Arr.map(refusals, (refusal) => refusal._tag)).toEqual(
          Arr.replicate("ChannelArchived", refusals.length)
        );

        yield* teacher.mutation(archive, { ...scope, archived: false });
        const back = yield* teacher.mutation(send, {
          ...note,
          clientKey: "back-message",
          text: "Kembali",
        });
        expect(back.text).toBe("Kembali");
      })
  );

  it.effect(
    "refuses a student, the general channel, and a channel of another class",
    () =>
      Effect.gen(function* () {
        const { fixture, forum, scope, teacher, term } = yield* topic;
        const other = yield* forumClass(fixture, term.id, "X-2", false);
        const refusals = yield* Effect.all([
          fixture
            .as("student")
            .mutation(archive, { ...scope, archived: true })
            .pipe(Effect.flip),
          fixture.as("student").mutation(remove, scope).pipe(Effect.flip),
          teacher
            .mutation(remove, { ...scope, classId: other.classId })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          denied("role"),
          denied("role"),
          denied("resource"),
        ]);
        const general = { ...forum, slug: nf };
        expect(
          yield* teacher
            .mutation(archive, { ...general, archived: true })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "ChannelFixed" });
        expect(
          yield* teacher.mutation(remove, general).pipe(Effect.flip)
        ).toMatchObject({ _tag: "ChannelFixed" });
      })
  );

  it.effect(
    "removes a channel at once, deletes what it held batch by batch, and gives the next channel the place after the last",
    () =>
      Effect.gen(function* () {
        const { fixture, forum, message, note, scope, teacher } = yield* topic;
        yield* teacher.mutation(start, {
          classId: scope.classId,
          messageId: message.id,
          slug: nf,
        });
        yield* teacher.mutation(open, {
          ...scope,
          clientKey: "whole-thread",
          mentions: [],
          text: "Mulai",
          title: "Mulai",
        });
        yield* teacher.mutation(mark, {
          at: 1,
          classId: scope.classId,
          place: { _tag: "channel", channelId: scope.channelId },
          slug: nf,
        });
        yield* Effect.forEach(
          Arr.range(1, 70),
          (index) =>
            teacher.mutation(send, {
              ...note,
              clientKey: `message-${index}`,
              text: `Pesan ${index}`,
            }),
          { discard: true }
        );
        const before = yield* fixture.run(rowsOf("classroomMessages"));
        expect(before).toBeGreaterThan(64);

        expect(yield* teacher.mutation(remove, scope)).toBeNull();
        const channels = yield* teacher.query(list, {
          ...firstPage,
          classId: scope.classId,
          slug: nf,
        });
        expect(Arr.map(channels.page, (found) => found.id)).toEqual([
          forum.channelId,
        ]);
        // A message the sweep has not reached yet answers as a missing object.
        expect(
          yield* teacher
            .mutation(edit, {
              classId: scope.classId,
              messageId: message.id,
              slug: nf,
              text: "Ubah",
            })
            .pipe(Effect.flip)
        ).toMatchObject(denied("resource"));

        yield* Effect.promise(() =>
          fixture.convex.finishAllScheduledFunctions(vi.runAllTimers)
        );
        expect(yield* fixture.run(rowsOf("classroomMessages"))).toBe(0);
        expect(yield* fixture.run(rowsOf("classroomThreads"))).toBe(0);
        expect(yield* fixture.run(rowsOf("classroomReads"))).toBe(0);

        const next = yield* teacher.mutation(add, {
          classId: scope.classId,
          name: "Baru",
          slug: nf,
        });
        const named = yield* teacher.query(list, {
          ...firstPage,
          classId: scope.classId,
          slug: nf,
        });
        expect(Arr.map(named.page, (found) => found.id)).toEqual([
          forum.channelId,
          next.id,
        ]);
      }),
    { timeout: 30_000 }
  );
});
