import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import notificationsInternal from "@repo/backend/confect/_generated/refs/notifications.server";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Class } from "@repo/backend/confect/classroom/access";
import { classAuthority } from "@repo/backend/confect/classroom/authority";
import { classSlugOf } from "@repo/backend/confect/classroom/class";
import type { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import { schoolKeys } from "@repo/backend/confect/classroom/forum/views";
import { classRoster } from "@repo/backend/confect/classroom/roster";
import {
  type LatePolicy,
  type TaskTargets,
  taskField,
} from "@repo/backend/confect/classroom/tasks/task";
import { scheduleTaskNotices } from "@repo/backend/confect/notifications/tasks";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { sealText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Clock, Duration, Effect, Option } from "effect";

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

/** The students a task names, refused as a missing object unless each of them learns in the allowed class. */
export const classTargets = Effect.fn("classroom.tasks.targets")(function* (
  targets: typeof TaskTargets.Type | null
) {
  if (targets === null) {
    return {};
  }
  const roster = yield* classRoster(yield* Class);
  const learners = Arr.map(roster, (person) => person._id);
  if (!Arr.every(targets, (personId) => Arr.contains(learners, personId))) {
    return yield* new AccessDenied({
      action: "task.manage",
      reason: "resource",
    });
  }
  return { targets };
});

/**
 * Publishes a task to the allowed class for its author: its text sealed with the
 * school key, under the first free address of its title, and records
 * `assignment.published`, the published change. The fan-out writes the inbox
 * row of each member it reaches, scheduled in the same transaction (ADR 0027).
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
  },
  reach: { readonly targets?: typeof TaskTargets.Type }
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
  const writer = yield* DatabaseWriter;
  const taskId = yield* writer
    .table("classroomTasks")
    .insert({
      ...fields,
      ...reach,
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
    notificationsInternal.fanout.run,
    { cursor: null, phase: "students", source: { _tag: "task", taskId } }
  );
  const jobs = yield* scheduleTaskNotices(
    { _id: taskId, deadline: draft.deadline },
    row.unitId
  );
  yield* writer
    .table("classroomTasks")
    .patch(taskId, { jobs })
    .pipe(Effect.orDie);
  return yield* reader.table("classroomTasks").get(taskId).pipe(Effect.orDie);
});
