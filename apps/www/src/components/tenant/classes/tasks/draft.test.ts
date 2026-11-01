import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Option, Schema } from "effect";
import { deadlineOf } from "@/components/tenant/classes/tasks/deadline";
import {
  checkedDraft,
  draftOf,
  EMPTY_DRAFT,
} from "@/components/tenant/classes/tasks/draft";
import type { ClassTask } from "@/components/tenant/classes/tasks/optimistic";

/** A task due at a whole minute, as its page reads it. */
const task: ClassTask = {
  category: "Latihan",
  deadline: Option.getOrThrow(deadlineOf("2026-11-02T23:59")),
  handedIn: 0,
  id: Schema.decodeUnknownSync(Id("classroomTasks"))("task-1"),
  latePolicy: "close",
  mine: null,
  points: 40,
  slug: "ringkasan",
  targets: null,
  text: "Kerjakan soal 1.",
  title: "Ringkasan",
};

describe("task drafts", () => {
  it("fills a task's form as the task stands, and checks it back to the same task", () => {
    expect(draftOf(task)).toEqual({
      category: "Latihan",
      deadline: "2026-11-02T23:59",
      latePolicy: "close",
      points: 40,
      targets: null,
      text: "Kerjakan soal 1.",
      title: "Ringkasan",
    });
    expect(checkedDraft(draftOf(task))).toEqual(
      Option.some({
        category: "Latihan",
        deadline: task.deadline,
        latePolicy: "close",
        points: 40,
        targets: null,
        text: "Kerjakan soal 1.",
        title: "Ringkasan",
      })
    );
  });

  it("reads a task without a category as an empty field, which saves no category", () => {
    const plain = draftOf({ ...task, category: null });
    expect(plain.category).toBe("");
    expect(checkedDraft(plain)).toMatchObject(Option.some({ category: null }));
  });

  it("trims the title and the text, and names no task while a field holds what the server refuses", () => {
    expect(
      checkedDraft({ ...draftOf(task), text: "  Soal 2.  ", title: " Baru " })
    ).toMatchObject(Option.some({ text: "Soal 2.", title: "Baru" }));
    expect(checkedDraft(EMPTY_DRAFT)).toEqual(Option.none());
    expect(checkedDraft({ ...draftOf(task), targets: [] })).toEqual(
      Option.none()
    );
    expect(
      checkedDraft({ ...draftOf(task), category: "x".repeat(41) })
    ).toEqual(Option.none());
    expect(
      Option.map(
        checkedDraft({ ...draftOf(task), category: "  " }),
        (next) => next.category
      )
    ).toEqual(Option.some(null));
    expect(checkedDraft({ ...draftOf(task), points: null })).toEqual(
      Option.none()
    );
    expect(checkedDraft({ ...draftOf(task), points: 1.5 })).toEqual(
      Option.none()
    );
    expect(checkedDraft({ ...draftOf(task), title: "   " })).toEqual(
      Option.none()
    );
  });
});
