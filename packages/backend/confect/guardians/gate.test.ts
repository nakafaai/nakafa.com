import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireConsent } from "@repo/backend/confect/guardians/gate";
import {
  forumClass,
  keyedFixture,
  nf,
  ofAge,
  period,
} from "@repo/backend/test/classroom";
import {
  asStaffSchool,
  type Fixture,
  setRoster,
  startLink,
} from "@repo/backend/test/guardians";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Option } from "effect";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** What the gate answers for the school's student: passed, or its refusal's tag. */
const gate = (fixture: Fixture) =>
  fixture.run(
    requireConsent(fixture.people.student.personId).pipe(
      Effect.as("passed"),
      Effect.catchTag("ConsentRequired", (error) => Effect.succeed(error.code))
    )
  );

describe("guardians/gate", () => {
  it.effect(
    "refuses a student without an age flag or under the limit until a link is verified",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        expect(yield* gate(fixture)).toBe("CONSENT_REQUIRED");
        yield* setRoster(fixture, { underAgeLimit: true });
        const link = yield* startLink(fixture);
        expect(yield* gate(fixture)).toBe("CONSENT_REQUIRED");
        yield* fixture
          .as("counselor")
          .mutation(refs.public.guardians.links.verify, {
            linkId: link.id,
            slug: nf,
          });
        expect(yield* gate(fixture)).toBe("passed");
        yield* fixture
          .as("counselor")
          .mutation(refs.public.guardians.links.revoke, {
            linkId: link.id,
            slug: nf,
          });
        expect(yield* gate(fixture)).toBe("CONSENT_REQUIRED");
      })
  );

  it.effect(
    "passes a student whom the school marks at or above the limit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        yield* setRoster(fixture, { underAgeLimit: false });
        expect(yield* gate(fixture)).toBe("passed");
      })
  );

  it.effect(
    "refuses a student's forum writes until the gate passes, and leaves a teacher's alone",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        yield* fixture.run(
          Effect.gen(function* () {
            const entry = yield* (yield* DatabaseReader)
              .table("rosterEntries")
              .index("by_personId", (query) =>
                query.eq("personId", fixture.people.student.personId)
              )
              .first();
            yield* (yield* DatabaseWriter)
              .table("rosterEntries")
              .delete(Option.getOrThrow(entry)._id);
          }).pipe(Effect.orDie)
        );
        const { messages, threads } = refs.public.classroom.forum;
        const post = (clientKey: string) => ({
          ...forum,
          clientKey,
          mentions: [],
          slug: nf,
          text: "Halo",
        });
        const teacher = fixture.as("teacher");
        const student = fixture.as("student");
        const opened = yield* teacher.mutation(threads.open, {
          ...post("teacher-opens"),
          title: "Tanya",
        });
        yield* teacher.mutation(messages.send, post("teacher-sends"));
        const refusal = { _tag: "ConsentRequired" };
        expect(
          yield* student
            .mutation(messages.send, post("student-sends"))
            .pipe(Effect.flip)
        ).toMatchObject(refusal);
        expect(
          yield* student
            .mutation(threads.open, {
              ...post("student-opens"),
              title: "Tanya",
            })
            .pipe(Effect.flip)
        ).toMatchObject(refusal);
        expect(
          yield* student
            .mutation(threads.reply, {
              classId: forum.classId,
              clientKey: "student-replies",
              mentions: [],
              number: opened.discussion.number,
              slug: nf,
              text: "Halo",
            })
            .pipe(Effect.flip)
        ).toMatchObject(refusal);
        yield* ofAge(fixture);
        const sent = yield* student.mutation(
          messages.send,
          post("student-sends")
        );
        expect(sent.text).toBe("Halo");
      })
  );
});
