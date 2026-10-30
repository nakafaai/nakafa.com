import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAuthority } from "@repo/backend/confect/classroom/authority";
import { classSlugOf } from "@repo/backend/confect/classroom/class";
import type { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import {
  type LatePolicy,
  taskField,
} from "@repo/backend/confect/classroom/tasks/task";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { sealText } from "@repo/backend/confect/vault/text";
import { Clock, Duration, Effect, Option } from "effect";

/**
 * The first free address of a title in a class: the title's own form, then the
 * same with `-2`, `-3`, and on. A title with no letter or digit takes `tugas`.
 */
const freeAddress = Effect.fn("classroom.tasks.address")(function* (
  title: string
) {
  const row = yield* Class;
  const reader = yield* DatabaseReader;
  const base = classSlugOf(title) || "tugas";
  const firstFree = (index: number): Effect.Effect<string> => {
    const slug = index === 1 ? base : `${base}-${index}`;
    return reader
      .table("classroomTasks")
      .index("by_classId_and_slug", (query) =>
        query.eq("classId", row._id).eq("slug", slug)
      )
      .first()
      .pipe(
        Effect.orDie,
        Effect.flatMap((taken) =>
          Option.isNone(taken) ? Effect.succeed(slug) : firstFree(index + 1)
        )
      );
  };
  return yield* firstFree(1);
});

/**
 * Publishes a task to the allowed class for its author: its text sealed with the
 * school key, under the first free address of its title, and records
 * `assignment.published`, the published change. The fan-out writes the inbox
 * row of each member of the class, scheduled in the same transaction (ADR 0027).
 * A repeat of a client key of the class answers that task and writes nothing.
 * A teacher's publish and the Classroom import both write through it.
 */
export const writeTask = Effect.fn("classroom.tasks.write")(function* (
  author: TenantPeopleDoc,
  draft: {
    readonly clientKey: typeof ClientKey.Type;
    readonly deadline: number;
    readonly latePolicy: typeof LatePolicy.Type;
    readonly points: number;
    readonly text: string;
    readonly title: string;
  }
) {
  const row = yield* Class;
  const reader = yield* DatabaseReader;
  const sent = yield* reader
    .table("classroomTasks")
    .index("by_classId_and_clientKey", (query) =>
      query.eq("classId", row._id).eq("clientKey", draft.clientKey)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(sent)) {
    return sent.value;
  }
  const fields = { classId: row._id, clientKey: draft.clientKey };
  const taskId = yield* (yield* DatabaseWriter)
    .table("classroomTasks")
    .insert({
      ...fields,
      authorId: author._id,
      createdAt: yield* Clock.currentTimeMillis,
      deadline: draft.deadline,
      handedIn: 0,
      latePolicy: draft.latePolicy,
      points: draft.points,
      sealedText: yield* sealText(
        yield* schoolKeys(row.tenantId),
        taskField(fields),
        draft.text
      ).pipe(Effect.orDie),
      slug: yield* freeAddress(draft.title),
      tenantId: row.tenantId,
      title: draft.title,
    })
    .pipe(Effect.orDie);
  yield* classAuthority.record(personActor(author), row, {
    task: taskId,
    type: "assignment.published",
  });
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    refs.internal.notifications.fanout.run,
    { cursor: null, phase: "students", source: { _tag: "task", taskId } }
  );
  return yield* reader.table("classroomTasks").get(taskId).pipe(Effect.orDie);
});
