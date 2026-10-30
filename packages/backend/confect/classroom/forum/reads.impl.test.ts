import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  denied,
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { actedAt, TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const reads = refs.public.classroom.forum.reads;
const channels = refs.public.classroom.forum.channels;
const { send } = refs.public.classroom.forum.messages;
const { open, reply } = refs.public.classroom.forum.threads;

describe("classroom/forum reads", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "marks a channel read up to a time that only moves forward and never past now, and the list shows the channel unread until then",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        const student = fixture.as("student");
        const place = {
          _tag: "channel" as const,
          channelId: forum.channelId,
        };
        const unread = () =>
          Effect.map(
            student.query(channels.list, {
              ...firstPage,
              classId: forum.classId,
              slug: nf,
            }),
            (listed) => Arr.map(listed.page, (channel) => channel.unread)
          );
        expect(yield* unread()).toEqual([false]);
        expect(
          yield* student.query(reads.get, {
            classId: forum.classId,
            place,
            slug: nf,
          })
        ).toEqual({ at: null });
        vi.setSystemTime(actedAt());
        const sent = yield* fixture.as("teacher").mutation(send, {
          ...forum,
          clientKey: "teacher-message",
          mentions: [],
          slug: nf,
          text: "Selamat pagi",
        });
        expect(yield* unread()).toEqual([true]);
        const marked = yield* student.mutation(reads.mark, {
          at: sent.createdAt,
          classId: forum.classId,
          place,
          slug: nf,
        });
        expect(marked).toEqual({ at: actedAt() });
        expect(yield* unread()).toEqual([false]);
        const back = yield* student.mutation(reads.mark, {
          at: actedAt() - 5000,
          classId: forum.classId,
          place,
          slug: nf,
        });
        expect(back).toEqual({ at: actedAt() });
        vi.setSystemTime(actedAt(1));
        const ahead = yield* student.mutation(reads.mark, {
          at: actedAt(60),
          classId: forum.classId,
          place,
          slug: nf,
        });
        expect(ahead).toEqual({ at: actedAt(1) });
        expect(
          yield* fixture.as("teacher").query(reads.get, {
            classId: forum.classId,
            place,
            slug: nf,
          })
        ).toEqual({ at: actedAt() });
      })
  );

  it.effect(
    "keeps the read mark of a discussion apart from its channel's, and lets a school leader mark what the leader reads",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-2");
        vi.setSystemTime(actedAt());
        yield* fixture.as("teacher").mutation(open, {
          ...forum,
          clientKey: "read-discussion",
          mentions: [],
          slug: nf,
          text: "Pembuka",
          title: "Diskusi",
        });
        vi.setSystemTime(actedAt(4));
        yield* fixture.as("student").mutation(reply, {
          classId: forum.classId,
          clientKey: "read-reply",
          mentions: [],
          number: 1,
          slug: nf,
          text: "Balasan",
        });
        const discussion = { _tag: "discussion" as const, number: 1 };
        const teacher = fixture.as("teacher");
        expect(
          yield* teacher.query(reads.get, {
            classId: forum.classId,
            place: discussion,
            slug: nf,
          })
        ).toEqual({ at: actedAt() });
        const admin = fixture.as("admin");
        const marked = yield* admin.mutation(reads.mark, {
          at: actedAt(4),
          classId: forum.classId,
          place: discussion,
          slug: nf,
        });
        expect(marked).toEqual({ at: actedAt(4) });
        expect(
          yield* admin.query(reads.get, {
            classId: forum.classId,
            place: { _tag: "channel", channelId: forum.channelId },
            slug: nf,
          })
        ).toEqual({ at: null });
      })
  );

  it.effect(
    "refuses a channel or a discussion of another class as missing objects",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const own = yield* forumClass(fixture, term.id, "X-3");
        const other = yield* forumClass(fixture, term.id, "X-4", false);
        const teacher = fixture.as("teacher");
        const refusals = yield* Effect.all([
          teacher
            .query(reads.get, {
              classId: own.classId,
              place: { _tag: "channel", channelId: other.channelId },
              slug: nf,
            })
            .pipe(Effect.flip),
          teacher
            .mutation(reads.mark, {
              at: TENANCY_NOW,
              classId: own.classId,
              place: { _tag: "discussion", number: 1 },
              slug: nf,
            })
            .pipe(Effect.flip),
        ]);
        expect(refusals).toMatchObject([
          denied("resource"),
          denied("resource"),
        ]);
      })
  );
});
