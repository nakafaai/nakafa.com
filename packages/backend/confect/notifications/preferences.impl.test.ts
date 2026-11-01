import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { queueMail } from "@repo/backend/confect/notifications/mail";
import {
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import {
  scheduledJobs,
  TENANCY_NOW,
  type tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option, String as Str } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;

const { list, set } = refs.public.notifications.preferences;
const { send } = refs.public.classroom.forum.messages;
const { subscribe } = refs.public.notifications.push;

/** Queues a late-task mail for the student, as a guardian's would be, and counts what waits. */
const mailed = (fixture: Fixture) =>
  fixture.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const person = yield* reader
        .table("tenantPeople")
        .get(fixture.people.student.personId);
      yield* queueMail(
        "taskMissed",
        "guardian",
        person,
        fixture.units.smp,
        Option.none()
      );
      const rows = yield* reader
        .table("noticeMails")
        .index("by_creation_time")
        .take(5);
      return rows.length;
    }).pipe(Effect.orDie)
  );

describe("notifications/preferences", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "holds a channel a member switched off, and sends again once it is on",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const student = fixture.as("student");
        const choice = {
          channel: "email",
          kind: "taskMissed",
          slug: nf,
        } as const;

        yield* student.mutation(set, { ...choice, on: false });
        yield* student.mutation(set, { ...choice, on: false });
        expect(yield* student.query(list, { slug: nf })).toEqual([
          { channel: "email", kind: "taskMissed" },
        ]);
        expect(yield* mailed(fixture)).toBe(0);

        yield* student.mutation(set, { ...choice, on: true });
        yield* student.mutation(set, { ...choice, on: true });
        expect(yield* student.query(list, { slug: nf })).toEqual([]);
        expect(yield* mailed(fixture)).toBe(1);
      })
  );

  it.effect("sends no push of a kind the member switched off", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const forum = yield* forumClass(fixture, term.id, "X-1");
      const student = fixture.as("student");
      yield* student.mutation(subscribe, {
        auth: "YXV0aC1zZWNyZXQ",
        endpoint: "https://push.example.test/student",
        p256dh: "Y2xpZW50LWtleQ",
      });
      const mention = (clientKey: string) =>
        fixture.as("teacher").mutation(send, {
          ...forum,
          attachments: [],
          clientKey,
          mentions: [{ _tag: "person", id: fixture.people.student.personId }],
          poll: null,
          slug: nf,
          text: "Halo",
        });
      const pushes = fixture.run(
        scheduledJobs.pipe(
          Effect.map(
            (jobs) =>
              Arr.filter(jobs, (job) => Str.includes("deliver")(job.name))
                .length
          )
        )
      );
      const choice = {
        channel: "push",
        kind: "forumMention",
        slug: nf,
      } as const;

      yield* student.mutation(set, { ...choice, on: false });
      yield* mention("mention-off");
      expect(yield* pushes).toBe(0);

      yield* student.mutation(set, { ...choice, on: true });
      yield* mention("mention-on");
      expect(yield* pushes).toBe(1);
    })
  );

  it.effect("keeps a channel the rules always send", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const student = fixture.as("student");
      yield* student.mutation(set, {
        channel: "email",
        kind: "invitation",
        on: false,
        slug: nf,
      });
      expect(yield* student.query(list, { slug: nf })).toEqual([]);
    })
  );
});
