import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { createCreatedExams } from "@/components/tenant/exams/created";

const examId = Schema.decodeUnknownSync(Id("exams"));

/** An exam as the create answers with it: no question is needed for the store. */
const view = (id: string) => ({
  archived: false,
  id: examId(id),
  questions: [],
  title: `Exam ${id}`,
});

describe("createCreatedExams", () => {
  it("holds the exam a create answered with until its own editor lets it go", () => {
    const store = createCreatedExams();
    expect(store.getState().held).toBeNull();

    store.getState().hold(view("first"));
    expect(store.getState().held).toEqual(view("first"));

    // Another exam's editor closing leaves the held exam in place.
    store.getState().release(examId("other"));
    expect(store.getState().held).toEqual(view("first"));

    store.getState().release(examId("first"));
    expect(store.getState().held).toBeNull();
  });

  it("holds only the exam the latest create answered with", () => {
    const store = createCreatedExams();
    store.getState().hold(view("first"));
    store.getState().hold(view("second"));
    expect(store.getState().held).toEqual(view("second"));
  });
});
