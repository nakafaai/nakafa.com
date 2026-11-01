import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { EMAIL_FROM, resend } from "@repo/backend/confect/emails/client";
import {
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { IBU } from "@repo/backend/test/guardians";
import { signedPages } from "@repo/backend/test/mail";
import {
  keyedExam,
  scheduleSitting,
  seedPlacement,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Duration, Effect, Schema } from "effect";

type Fixture = Effect.Success<typeof keyedFixture>;
type Mails = Effect.Success<ReturnType<typeof swept>>;

const digest = refs.internal.emails.digest.internal;
const grades = refs.public.records.grades;
const tasks = refs.public.classroom.tasks;
const taskNotices = refs.internal.notifications.tasks;
const sittings = refs.internal.notifications.sittings;
const fanout = refs.internal.notifications.fanout;
const messages = refs.public.classroom.forum.messages;
const { addComment } = refs.public.comments.mutations;

const DAY = Duration.toMillis(Duration.days(1));
const HOUR = Duration.toMillis(Duration.hours(1));
const INBOX = "http://nf.localhost:3000/notifications";
const SLUG = "articles/example";

/** What the mail provider is handed of one mail. */
const Mail = Schema.Struct({
  from: Schema.String,
  html: Schema.String,
  subject: Schema.String,
  to: Schema.String,
});

/** What one mail must say, and to whom. */
const Expected = Schema.Struct({
  link: Schema.String,
  subject: Schema.String,
  to: Schema.String,
});

/** A school with its key and the signed Pages every mail links to, as production holds them. */
const school = Effect.tap(keyedFixture, (fixture) => fixture.run(signedPages));

/** What one sweep of the queue hands the mail provider, as the cron runs it. */
const swept = (fixture: Fixture) =>
  Effect.gen(function* () {
    const send = vi.spyOn(resend, "sendEmail");
    send.mockClear();
    yield* fixture.internal.action(digest.send, {});
    return yield* Effect.forEach(send.mock.calls, ([, message]) =>
      Schema.decodeUnknownEffect(Mail)(message).pipe(Effect.orDie)
    );
  });

/** The address of an account. */
const addressOf = (
  fixture: Fixture,
  userId: Fixture["users"]["admin"]["userId"]
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("users")
        .get(userId)
        .pipe(
          Effect.map((user) => user.email),
          Effect.orDie
        )
    )
  );

/** The one mail of a sweep: from Nakafa, to `to`, with `subject`, a link to `link`, and no name in it (ADR 0027). */
const expectOneMail = (mails: Mails, mail: typeof Expected.Type) => {
  expect(mails).toMatchObject([
    { from: EMAIL_FROM, subject: mail.subject, to: mail.to },
  ]);
  expect(mails[0]?.html).toContain(mail.link);
  expect(mails[0]?.html).not.toContain("Student");
  expect(mails[0]?.html).not.toContain("Ibu Raka");
};

/** A guardian of the fixture's student with a verified link, who signs in with the fixture's admin account. */
const verifiedGuardian = (fixture: Fixture) =>
  fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      const guardianPersonId = yield* writer.table("tenantPeople").insert({
        account: {
          claimedAt: TENANCY_NOW,
          method: "invite",
          state: "claimed",
          userId: fixture.users.admin.userId,
        },
        kind: "member",
        name: "Ibu Raka",
        status: "active",
        tenantId: fixture.tenants.nf,
      });
      yield* writer.table("guardianLinks").insert({
        email: IBU,
        expiresAt: TENANCY_NOW + 1,
        guardianPersonId,
        mismatches: 0,
        startedBy: fixture.people.admin.personId,
        state: { at: TENANCY_NOW, status: "verified" },
        studentPersonId: fixture.people.student.personId,
        tenantId: fixture.tenants.nf,
      });
    }).pipe(Effect.orDie)
  );

/** A class with the fixture's student placed in it, and one published task of it. */
const publishedTask = Effect.fn("test.notifications.mail.task")(function* (
  fixture: Fixture
) {
  const term = yield* period(fixture, fixture.units.smp);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  const task = yield* fixture.as("teacher").mutation(tasks.publish, {
    category: null,
    classId: forum.classId,
    clientKey: "mail-task",
    deadline: TENANCY_NOW + 3 * DAY,
    latePolicy: "accept",
    points: 100,
    slug: nf,
    targets: null,
    text: "Kerjakan soal 1 sampai 10.",
    title: "Latihan Gerak Lurus",
  });
  return task.id;
});

/** A cohort sitting that expects the fixture's student, opening two days ahead. */
const cohortSitting = Effect.fn("test.notifications.mail.sitting")(function* (
  fixture: Fixture
) {
  const examId = yield* keyedExam(fixture, "Ujian Fisika");
  const cohortId = yield* seedPlacement(
    fixture,
    fixture.people.student.personId
  );
  const opensAt = TENANCY_NOW + 2 * DAY;
  return yield* scheduleSitting(fixture, {
    closesAt: opensAt + HOUR,
    examId,
    group: { cohortId, kind: "cohort" },
    opensAt,
  });
});

describe("notifications/mail", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "delivers a released grade to the guardian, never to the student",
    () =>
      Effect.gen(function* () {
        const fixture = yield* school;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        yield* verifiedGuardian(fixture);
        const entered = yield* fixture.as("teacher").mutation(grades.enter, {
          classId: forum.classId,
          personId: fixture.people.student.personId,
          slug: nf,
          value: 80,
        });
        yield* fixture
          .as("teacher")
          .mutation(grades.release, { gradeId: entered.id, slug: nf });
        expectOneMail(yield* swept(fixture), {
          link: INBOX,
          subject: "Ada nilai baru yang dirilis.",
          to: yield* addressOf(fixture, fixture.users.admin.userId),
        });
      })
  );

  it.effect("delivers a late task to the guardian", () =>
    Effect.gen(function* () {
      const fixture = yield* school;
      const taskId = yield* publishedTask(fixture);
      yield* verifiedGuardian(fixture);
      yield* fixture.internal.mutation(taskNotices.run, {
        cursor: null,
        notice: "taskMissed",
        taskId,
      });
      expectOneMail(yield* swept(fixture), {
        link: INBOX,
        subject: "Anakmu belum mengumpulkan tugas tepat waktu.",
        to: yield* addressOf(fixture, fixture.users.admin.userId),
      });
    })
  );

  it.effect(
    "delivers the start of a sitting to its student, and the reminder to the guardian",
    () =>
      Effect.gen(function* () {
        const fixture = yield* school;
        const made = yield* cohortSitting(fixture);
        yield* verifiedGuardian(fixture);
        yield* fixture.internal.mutation(sittings.run, {
          cursor: null,
          notice: "examStart",
          sittingId: made.id,
        });
        expectOneMail(yield* swept(fixture), {
          link: INBOX,
          subject: "Ujianmu segera dimulai.",
          to: yield* addressOf(fixture, fixture.users.student.userId),
        });
        yield* fixture.internal.mutation(sittings.run, {
          cursor: null,
          notice: "examGuardianReminder",
          sittingId: made.id,
        });
        expectOneMail(yield* swept(fixture), {
          link: INBOX,
          subject: "Anakmu akan mengikuti ujian.",
          to: yield* addressOf(fixture, fixture.users.admin.userId),
        });
      })
  );

  it.effect("holds a new task for the 17:00 digest, then delivers it", () =>
    Effect.gen(function* () {
      const fixture = yield* school;
      const taskId = yield* publishedTask(fixture);
      yield* fixture.internal.mutation(fanout.run, {
        cursor: null,
        phase: "students",
        source: { _tag: "task", taskId },
      });
      expect(yield* swept(fixture)).toEqual([]);
      vi.setSystemTime(TENANCY_NOW + DAY);
      expectOneMail(yield* swept(fixture), {
        link: INBOX,
        subject: "Ada tugas baru di kelasmu.",
        to: yield* addressOf(fixture, fixture.users.student.userId),
      });
    })
  );

  it.effect("holds a mention for the 17:00 digest, then delivers it", () =>
    Effect.gen(function* () {
      const fixture = yield* school;
      const term = yield* period(fixture, fixture.units.smp);
      const forum = yield* forumClass(fixture, term.id, "X-1");
      yield* fixture.as("teacher").mutation(messages.send, {
        attachments: [],
        poll: null,
        ...forum,
        clientKey: "mail-mention",
        mentions: [{ _tag: "person", id: fixture.people.student.personId }],
        slug: nf,
        text: "@Student tolong kumpulkan tugasnya.",
      });
      expect(yield* swept(fixture)).toEqual([]);
      vi.setSystemTime(TENANCY_NOW + DAY);
      expectOneMail(yield* swept(fixture), {
        link: INBOX,
        subject: "Seseorang menyebutmu di kelas.",
        to: yield* addressOf(fixture, fixture.users.student.userId),
      });
    })
  );

  it.effect(
    "holds the replies to a comment for the 17:00 digest, then delivers them to its author's account",
    () =>
      Effect.gen(function* () {
        const fixture = yield* school;
        const parentId = yield* fixture
          .as("student")
          .mutation(addComment, { slug: SLUG, text: "Pertanyaan" });
        yield* fixture
          .as("teacher")
          .mutation(addComment, { parentId, slug: SLUG, text: "Jawaban" });
        yield* fixture
          .as("admin")
          .mutation(addComment, { parentId, slug: SLUG, text: "Jawaban lain" });
        expect(yield* swept(fixture)).toEqual([]);
        vi.setSystemTime(TENANCY_NOW + DAY);
        const mails = yield* swept(fixture);
        expectOneMail(mails, {
          link: "http://localhost:3000/id/notifications",
          subject: "Ada 2 balasan untuk komentarmu.",
          to: yield* addressOf(fixture, fixture.users.student.userId),
        });
        expect(mails[0]?.html).toContain("karena kamu berkomentar di Nakafa");
      })
  );
});
