import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { detailOf } from "@repo/backend/confect/notifications/detail";
import {
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { send } = refs.public.classroom.forum.messages;
const posts = refs.public.classroom.posts;
const tasks = refs.public.classroom.tasks;

describe("notifications/detail", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "gives no detail once a row's task, message, or class is gone, and no author's name once the author is",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(posts.publish, {
          classId: forum.classId,
          clientKey: "detail-post",
          email: false,
          slug: nf,
          text: "Ulangan hari Senin.",
        });
        yield* teacher.mutation(tasks.publish, {
          classId: forum.classId,
          clientKey: "detail-task",
          deadline: TENANCY_NOW + 86_400_000,
          latePolicy: "accept",
          points: 10,
          slug: nf,
          text: "Kerjakan soal 1.",
          title: "Latihan",
        });
        yield* teacher.mutation(send, {
          ...forum,
          clientKey: "detail-mention",
          mentions: [{ _tag: "person", id: fixture.people.student.personId }],
          slug: nf,
          text: "@Student",
        });
        yield* fixture.finishScheduled();
        const details = yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const writer = yield* DatabaseWriter;
            const student = yield* reader
              .table("tenantPeople")
              .get(fixture.people.student.personId);
            const tenant = yield* reader
              .table("tenants")
              .get(fixture.tenants.nf);
            const rows = yield* reader
              .table("notifications")
              .index("by_creation_time")
              .take(20);
            const ofType = (changeType: string) =>
              Arr.getUnsafe(
                Arr.filter(
                  rows,
                  (row) =>
                    row.changeType === changeType &&
                    row.recipientPersonId === student._id
                ),
                0
              );
            const detail = (changeType: string) =>
              detailOf(ofType(changeType), student, tenant);
            const task = ofType("assignment.published");
            const mention = ofType("forum.mentioned");
            if (
              task.changeType !== "assignment.published" ||
              mention.changeType !== "forum.mentioned"
            ) {
              return yield* Effect.die(
                "The rows were written for the student."
              );
            }
            yield* writer.table("classroomTasks").delete(task.taskId);
            yield* writer.table("classroomMessages").delete(mention.messageId);
            yield* writer
              .table("tenantPeople")
              .delete(fixture.people.teacher.personId);
            const authorGone = yield* detail("announcement.posted");
            const taskGone = yield* detail("assignment.published");
            const messageGone = yield* detail("forum.mentioned");
            yield* writer.table("classes").delete(forum.classId);
            const classGone = yield* detail("announcement.posted");
            return { authorGone, classGone, messageGone, taskGone };
          }).pipe(Effect.orDie)
        );
        expect(details.authorGone).toMatchObject({ actor: "" });
        expect(details).toMatchObject({
          classGone: null,
          messageGone: null,
          taskGone: null,
        });
      })
  );
});
