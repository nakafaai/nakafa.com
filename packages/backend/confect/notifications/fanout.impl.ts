import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ClassesDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { mayIn, principalOf } from "@repo/backend/confect/classroom/roster";
import { schedulePush } from "@repo/backend/confect/notifications/schedule";
import spec, {
  type FanoutPhase,
  type FanoutSource,
} from "@repo/backend/confect/notifications/fanout.spec";
import { Array as Arr, Duration, Effect, Layer, Match, Option } from "effect";

/** Persons one run notifies, the batch of ADR 0027. */
const FANOUT_BATCH = 100;

/**
 * The notice a source makes: its class, its author, its time, the row fields that
 * name it, whether its author chose email for it, and the Persons it already
 * notified on its own (the Persons a message names). A source that no longer stands, such as a removed announcement, makes
 * none.
 */
const noticeOf = Effect.fn("notifications.fanout.notice")(function* (
  source: typeof FanoutSource.Type
) {
  const reader = yield* DatabaseReader;
  return yield* Match.valueTags(source, {
    mention: ({ messageId }) =>
      Effect.map(
        reader.table("classroomMessages").get(messageId).pipe(Effect.option),
        Option.map((message) => ({
          authorId: message.authorId,
          classId: message.classId,
          createdAt: message.createdAt,
          email: false,
          fields: { changeType: "forum.mentioned" as const, messageId },
          named: Arr.flatMap(message.mentions ?? [], (mention) =>
            mention._tag === "person" ? [mention.id] : []
          ),
        }))
      ),
    post: ({ postId }) =>
      Effect.map(
        reader.table("classroomPosts").get(postId).pipe(Effect.option),
        Option.map((post) => ({
          authorId: post.authorId,
          classId: post.classId,
          createdAt: post.createdAt,
          email: post.email,
          fields: { changeType: "announcement.posted" as const, postId },
          named: [],
        }))
      ),
  });
});

/** One page of a phase of the class roster: the Persons and where the next page starts. */
const rosterPage = Effect.fn("notifications.fanout.page")(function* (
  klass: ClassesDoc,
  phase: typeof FanoutPhase.Type,
  cursor: string | null
) {
  const reader = yield* DatabaseReader;
  const paginationOpts = { cursor, numItems: FANOUT_BATCH };
  if (phase === "students") {
    const page = yield* reader
      .table("tenantCohortMembers")
      .index("by_cohortId_and_personId", (query) =>
        query.eq("cohortId", klass.cohortId)
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return { ...page, people: Arr.map(page.page, (row) => row.personId) };
  }
  const page = yield* reader
    .table("classTeachers")
    .index("by_classId_and_personId", (query) => query.eq("classId", klass._id))
    .paginate(paginationOpts)
    .pipe(Effect.orDie);
  return { ...page, people: Arr.map(page.page, (row) => row.personId) };
});

/** The run after a page: the next page of the phase, the teachers once the students are done, or none at the end. */
const nextRun = (
  page: { readonly continueCursor: string; readonly isDone: boolean },
  phase: typeof FanoutPhase.Type
) => {
  if (!page.isDone) {
    return Option.some({ cursor: page.continueCursor, phase });
  }
  return phase === "students"
    ? Option.some({ cursor: null, phase: "teachers" as const })
    : Option.none();
};

/**
 * Writes one batch of a notice's rows: each Person of the page who reads the
 * class now, but the author and the Persons the source already notified, gets one
 * row at the notice's time, and its push is scheduled. When the author of an
 * announcement chose email, the batch's recipients get its notice email. The next run reads the next page, and the teachers
 * follow the students.
 */
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("notifications.fanout.run")(function* ({ cursor, phase, source }) {
    const notice = yield* noticeOf(source);
    if (Option.isNone(notice)) {
      return null;
    }
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const klass = yield* reader
      .table("classes")
      .get(notice.value.classId)
      .pipe(Effect.orDie);
    const tenant = yield* reader
      .table("tenants")
      .get(klass.tenantId)
      .pipe(Effect.orDie);
    const page = yield* rosterPage(klass, phase, cursor);
    const notified = yield* Effect.forEach(
      Arr.filter(
        Arr.dedupe(page.people),
        (personId) =>
          personId !== notice.value.authorId &&
          !Arr.contains(notice.value.named, personId)
      ),
      (personId) =>
        Effect.gen(function* () {
          const person = yield* reader
            .table("tenantPeople")
            .get(personId)
            .pipe(Effect.orDie);
          if (person.status !== "active") {
            return Option.none();
          }
          const principal = yield* principalOf(person, tenant);
          if (!(yield* mayIn("forum.read", klass, principal))) {
            return Option.none();
          }
          const notificationId = yield* writer
            .table("notifications")
            .insert({
              ...notice.value.fields,
              createdAt: notice.value.createdAt,
              recipientPersonId: personId,
              subject: { id: klass._id, kind: "class" },
              tenantId: klass.tenantId,
            })
            .pipe(Effect.orDie);
          yield* schedulePush(
            notificationId,
            person,
            principal.grants,
            klass.unitId
          );
          return Option.some(personId);
        })
    );
    const recipients = Arr.getSomes(notified);
    if (
      notice.value.email &&
      source._tag === "post" &&
      Arr.isReadonlyArrayNonEmpty(recipients)
    ) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.emails.notice.internal.send,
        { postId: source.postId, recipients }
      );
    }
    const next = nextRun(page, phase);
    if (Option.isSome(next)) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.notifications.fanout.run,
        { ...next.value, source }
      );
    }
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
