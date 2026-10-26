import type { GenericId } from "@confect/core";
import type { ClassesDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { subjectTeacherOf } from "@repo/backend/confect/classroom/authority";
import { MentionRefused } from "@repo/backend/confect/classroom/forum/errors";
import type { Mention } from "@repo/backend/confect/classroom/forum/mention";
import { mayIn, principalOf } from "@repo/backend/confect/classroom/roster";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { schedulePush } from "@repo/backend/confect/notifications/schedule";
import { Array as Arr, Duration, Effect, Option } from "effect";

/**
 * The mentions of a message, checked before it is written: each Person once, each
 * one an active Person who writes in the class now, and everyone only from a
 * subject teacher of the class (ADR 0025). Any other mention refuses the message.
 * It answers the mentions as they are stored and the Persons they name.
 */
export const checkMentions = Effect.fn("classroom.forum.notice.check")(
  function* (row: ClassesDoc, mentions: readonly (typeof Mention.Type)[]) {
    const principal = yield* Member;
    const reader = yield* DatabaseReader;
    const everyone = Arr.some(
      mentions,
      (mention) => mention._tag === "everyone"
    );
    if (everyone && !(yield* subjectTeacherOf(row, principal))) {
      return yield* new MentionRefused();
    }
    const ids = Arr.dedupe(
      Arr.flatMap(mentions, (mention) =>
        mention._tag === "person" ? [mention.id] : []
      )
    );
    const people = yield* Effect.forEach(ids, (id) =>
      Effect.gen(function* () {
        const person = yield* reader
          .table("tenantPeople")
          .get(id)
          .pipe(Effect.option);
        if (
          Option.isNone(person) ||
          person.value.tenantId !== row.tenantId ||
          person.value.status !== "active"
        ) {
          return yield* new MentionRefused();
        }
        const mentioned = yield* principalOf(person.value, principal.tenant);
        if (!(yield* mayIn("forum.post", row, mentioned))) {
          return yield* new MentionRefused();
        }
        return mentioned;
      })
    );
    return {
      everyone,
      people,
      stored: Arr.appendAll(
        Arr.map(ids, (id) => ({ _tag: "person" as const, id })),
        everyone ? [{ _tag: "everyone" as const }] : []
      ),
    };
  }
);

/**
 * Writes the inbox row of each Person a new message mentions, the sender left
 * out, in the transaction of the message, so a failed message leaves no row (ADR
 * 0027), and schedules each row's push. A mention of everyone schedules the
 * fan-out that writes the rest of the class in batches; Convex schedules both
 * only if the message commits.
 */
export const noticeMentions = Effect.fn("classroom.forum.notice.write")(
  function* (
    messageId: GenericId.GenericId<"classroomMessages">,
    row: ClassesDoc,
    createdAt: number,
    checked: Effect.Success<ReturnType<typeof checkMentions>>
  ) {
    const { person } = yield* Member;
    const writer = yield* DatabaseWriter;
    yield* Effect.forEach(
      Arr.filter(
        checked.people,
        (mentioned) => mentioned.person._id !== person._id
      ),
      (mentioned) =>
        Effect.gen(function* () {
          const notificationId = yield* writer
            .table("notifications")
            .insert({
              changeType: "forum.mentioned",
              createdAt,
              messageId,
              recipientPersonId: mentioned.person._id,
              subject: { id: row._id, kind: "class" },
              tenantId: row.tenantId,
            })
            .pipe(Effect.orDie);
          yield* schedulePush(
            notificationId,
            mentioned.person,
            mentioned.grants,
            row.unitId
          );
        }),
      { discard: true }
    );
    if (checked.everyone) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.notifications.fanout.run,
        {
          cursor: null,
          phase: "students",
          source: { _tag: "mention", messageId },
        }
      );
    }
  }
);
