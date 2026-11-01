import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { resend } from "@repo/backend/confect/emails/client";
import { loginAddress } from "@repo/backend/confect/identity/address";
import {
  queueMail,
  queueReplyMail,
} from "@repo/backend/confect/notifications/mail";
import { keyedFixture } from "@repo/backend/test/classroom";
import { signedPages } from "@repo/backend/test/mail";
import { TENANCY_NOW, type tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect, Option } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;
type PersonId = GenericId.GenericId<"tenantPeople">;
type UserId = GenericId.GenericId<"users">;

const digest = refs.internal.emails.digest.internal;
const DAY = Duration.toMillis(Duration.days(1));

/** Queues one mail of a kind for one Person, as a notice does. */
const queued = (
  fixture: Fixture,
  kind: Parameters<typeof queueMail>[0],
  relation: Parameters<typeof queueMail>[1],
  personId: PersonId,
  anchor: Option.Option<number> = Option.none()
) =>
  fixture.run(
    Effect.gen(function* () {
      const person = yield* (yield* DatabaseReader)
        .table("tenantPeople")
        .get(personId);
      yield* queueMail(kind, relation, person, fixture.units.smp, anchor);
    }).pipe(Effect.orDie)
  );

/** Queues the digest of one reply for one account, as a reply does. */
const replied = (fixture: Fixture, userId: UserId) =>
  fixture.run(queueReplyMail(userId).pipe(Effect.orDie));

/** The rows still on the queue. */
const waiting = (fixture: Fixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("noticeMails")
        .index("by_creation_time")
        .take(100)
        .pipe(Effect.orDie)
    )
  );

describe("emails/digest/internal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "shares one mail among a recipient's due rows, and links to the school's inbox",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        yield* fixture.run(signedPages);
        const student = fixture.people.student.personId;
        yield* queued(fixture, "examStart", "student", student);
        yield* queued(fixture, "examStart", "student", student);
        yield* queued(fixture, "gradeReleased", "guardian", student);
        // The rules give a student's own grade no email, so it queues nothing.
        yield* queued(fixture, "gradeReleased", "student", student);
        expect(yield* waiting(fixture)).toHaveLength(3);
        const mails = yield* fixture.internal.mutation(digest.claim, {});
        expect(mails).toHaveLength(1);
        expect(mails[0]?.input).toMatchObject({
          counts: [
            { change: "exam.starting", count: 2 },
            { change: "grade.released", count: 1 },
          ],
          inboxUrl: "http://nf.localhost:3000/notifications",
          locale: "id",
        });
        expect(yield* waiting(fixture)).toEqual([]);
        expect(yield* fixture.internal.mutation(digest.claim, {})).toEqual([]);
      })
  );

  it.effect(
    "holds a digest until 17:00 at the school, and drops what expired or cannot be mailed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        yield* fixture.run(signedPages);
        const student = fixture.people.student.personId;
        const teacher = fixture.people.teacher.personId;
        yield* queued(fixture, "forumMention", "teacher", teacher);
        expect(yield* fixture.internal.mutation(digest.claim, {})).toEqual([]);
        expect(yield* waiting(fixture)).toHaveLength(1);
        yield* queued(
          fixture,
          "examStart",
          "student",
          student,
          Option.some(TENANCY_NOW - 1)
        );
        expect(yield* fixture.internal.mutation(digest.claim, {})).toEqual([]);
        vi.setSystemTime(TENANCY_NOW + DAY);
        const mails = yield* fixture.internal.mutation(digest.claim, {});
        expect(mails).toMatchObject([
          { input: { counts: [{ change: "forum.mentioned", count: 1 }] } },
        ]);
        expect(yield* waiting(fixture)).toEqual([]);

        // A member with a school login, and a member who left, get no mail.
        yield* queued(fixture, "examStart", "student", student);
        yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            const person = yield* (yield* DatabaseReader)
              .table("tenantPeople")
              .get(student);
            if (person.account.state === "claimed") {
              yield* writer.table("users").patch(person.account.userId, {
                email: loginAddress("raka"),
              });
            }
          }).pipe(Effect.orDie)
        );
        expect(yield* fixture.internal.mutation(digest.claim, {})).toEqual([]);
        yield* queued(fixture, "examStart", "student", teacher);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantUnits").patch(fixture.units.smp, {
              status: "archived",
            })
          ).pipe(Effect.orDie)
        );
        expect(yield* fixture.internal.mutation(digest.claim, {})).toEqual([]);
        yield* queued(fixture, "examStart", "student", teacher);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("tenantPeople").patch(teacher, { status: "removed" })
          ).pipe(Effect.orDie)
        );
        expect(yield* fixture.internal.mutation(digest.claim, {})).toEqual([]);
      })
  );

  it.effect(
    "counts an account's replies in one mail, and drops what expired or cannot be mailed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        yield* fixture.run(signedPages);
        const student = fixture.users.student.userId;
        const teacher = fixture.users.teacher.userId;
        yield* replied(fixture, student);
        yield* replied(fixture, student);
        // A reply waits for the digest.
        expect(yield* fixture.internal.mutation(digest.claim, {})).toEqual([]);
        vi.setSystemTime(TENANCY_NOW + DAY);
        const mails = yield* fixture.internal.mutation(digest.claim, {});
        expect(mails).toMatchObject([
          {
            input: {
              counts: [{ change: "comment.replied", count: 2 }],
              inboxUrl: "http://localhost:3000/id/notifications",
              locale: "id",
            },
          },
        ]);
        expect(yield* waiting(fixture)).toEqual([]);

        // A reply a week old tells nothing the inbox does not.
        yield* replied(fixture, student);
        vi.setSystemTime(TENANCY_NOW + 9 * DAY);
        expect(yield* fixture.internal.mutation(digest.claim, {})).toEqual([]);

        // A school login, an account being deleted, and an account that is gone get no mail.
        yield* replied(fixture, student);
        yield* replied(fixture, teacher);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("users")
              .patch(student, { email: loginAddress("raka") })
          ).pipe(Effect.orDie)
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("users").patch(teacher, { deletedAt: TENANCY_NOW })
          ).pipe(Effect.orDie)
        );
        vi.setSystemTime(TENANCY_NOW + 10 * DAY);
        expect(yield* fixture.internal.mutation(digest.claim, {})).toEqual([]);
        expect(yield* waiting(fixture)).toEqual([]);
        yield* replied(fixture, teacher);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("users").delete(teacher)
          ).pipe(Effect.orDie)
        );
        vi.setSystemTime(TENANCY_NOW + 11 * DAY);
        expect(yield* fixture.internal.mutation(digest.claim, {})).toEqual([]);
        expect(yield* waiting(fixture)).toEqual([]);
      })
  );

  it.effect(
    "stops at the day's limit, leaves the rest waiting, and starts over the next day",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        yield* fixture.run(signedPages);
        const student = fixture.people.student.personId;
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("noticeMailBudget")
              .insert({ day: "2020-01-01", sent: 80 })
          ).pipe(Effect.orDie)
        );
        yield* queued(fixture, "examStart", "student", student);
        // Another day's count does not stop today's mail.
        expect(yield* fixture.internal.mutation(digest.claim, {})).toHaveLength(
          1
        );
        const budget = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader
              .table("noticeMailBudget")
              .index("by_creation_time")
              .first()
              .pipe(Effect.map(Option.getOrThrow), Effect.orDie)
          )
        );
        expect(budget.sent).toBe(1);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("noticeMailBudget").patch(budget._id, { sent: 80 })
          ).pipe(Effect.asVoid, Effect.orDie)
        );
        yield* queued(fixture, "examStart", "student", student);
        expect(yield* fixture.internal.mutation(digest.claim, {})).toEqual([]);
        expect(yield* waiting(fixture)).toHaveLength(1);
        vi.setSystemTime(TENANCY_NOW + DAY);
        expect(yield* fixture.internal.mutation(digest.claim, {})).toHaveLength(
          1
        );
      })
  );

  it.effect("renders what is due and hands it to the mail provider", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* fixture.run(signedPages);
      const send = vi.spyOn(resend, "sendEmail");
      yield* fixture.internal.action(digest.send, {});
      expect(send).not.toHaveBeenCalled();
      yield* queued(
        fixture,
        "examStart",
        "student",
        fixture.people.student.personId
      );
      yield* fixture.internal.action(digest.send, {});
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]?.[1]).toMatchObject({
        subject: "Ujianmu segera dimulai.",
      });
      expect(Arr.isReadonlyArrayEmpty(yield* waiting(fixture))).toBe(true);
    })
  );
});
