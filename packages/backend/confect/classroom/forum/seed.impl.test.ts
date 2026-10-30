import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  firstPage,
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { slugOf, TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { history } = refs.internal.classroom.forum.seed;
const { page } = refs.public.classroom.forum.messages;
const reads = refs.public.classroom.forum.reads;

/** The flag lets the seed run, as the acceptance runtime sets it. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
  vi.stubEnv("ACCEPTANCE_SEED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("classroom/forum seed history", () => {
  it.effect(
    "writes sealed messages a minute apart ending now, and the teacher's read mark after the first ones",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        const seeded = yield* fixture.internal.mutation(history, {
          classSlug: "fisika-x-1",
          count: 5,
          read: 2,
          slug: nf,
        });
        expect(seeded).toMatchObject(forum);
        const listed = yield* fixture
          .as("teacher")
          .query(page, { ...firstPage, ...forum, slug: nf });
        expect(Arr.map(listed.page, (message) => message.text)).toEqual([
          "Pesan 5",
          "Pesan 4",
          "Pesan 3",
          "Pesan 2",
          "Pesan 1",
        ]);
        expect(Arr.map(listed.page, (message) => message.createdAt)).toEqual(
          Arr.map([0, 1, 2, 3, 4], (minutes) => TENANCY_NOW - minutes * 60_000)
        );
        const mark = yield* fixture.as("teacher").query(reads.get, {
          classId: forum.classId,
          place: { _tag: "channel", channelId: forum.channelId },
          slug: nf,
        });
        expect(mark).toEqual({ at: TENANCY_NOW - 3 * 60_000 });
        yield* fixture.internal.mutation(history, {
          classSlug: "fisika-x-1",
          count: 1,
          read: 0,
          slug: nf,
        });
        const unchanged = yield* fixture.as("teacher").query(reads.get, {
          classId: forum.classId,
          place: { _tag: "channel", channelId: forum.channelId },
          slug: nf,
        });
        expect(unchanged).toEqual(mark);
      })
  );

  it.effect(
    "refuses outside the acceptance runtime, and a school or a class that does not exist",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const refusals = yield* Effect.all([
          fixture.internal
            .mutation(history, {
              classSlug: "fisika-x-1",
              count: 1,
              read: 0,
              slug: slugOf("missing"),
            })
            .pipe(Effect.flip),
          fixture.internal
            .mutation(history, {
              classSlug: "kimia-x-9",
              count: 1,
              read: 0,
              slug: nf,
            })
            .pipe(Effect.flip),
        ]);
        expect(Arr.map(refusals, (refusal) => refusal._tag)).toEqual([
          "TenantNotFound",
          "AccessDenied",
        ]);
        vi.stubEnv("ACCEPTANCE_SEED", "false");
        const refused = yield* fixture.internal
          .mutation(history, {
            classSlug: "fisika-x-1",
            count: 1,
            read: 0,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused._tag).toBe("SeedRefused");
      })
  );
});
