import { describe, expect, it } from "@effect/vitest";
import { createExamTry } from "@/components/tenant/exams/try/store";

describe("exam try store", () => {
  it("keeps the option chosen for each question", () => {
    const store = createExamTry();

    store.getState().choose("q1", ["a"]);
    store.getState().choose("q2", ["b"]);

    expect(store.getState().responses).toEqual({ q1: ["a"], q2: ["b"] });
  });

  it("replaces the option chosen for a question when the teacher changes it", () => {
    const store = createExamTry();

    store.getState().choose("q1", ["a"]);
    store.getState().choose("q1", ["c"]);

    expect(store.getState().responses).toEqual({ q1: ["c"] });
  });

  it("clears a question's answer when no option is chosen, and keeps the other answers", () => {
    const store = createExamTry();

    store.getState().choose("q1", ["a"]);
    store.getState().choose("q2", ["b"]);
    store.getState().choose("q1", []);

    expect(store.getState().responses).toEqual({ q2: ["b"] });
  });

  it("keeps the text typed for a short answer, and clears it once the text is blank", () => {
    const store = createExamTry();

    store.getState().choose("q1", { text: "Jakarta" });
    expect(store.getState().responses).toEqual({ q1: { text: "Jakarta" } });

    store.getState().choose("q1", { text: "  " });
    expect(store.getState().responses).toEqual({});
  });

  it("gives every try its own answers", () => {
    const first = createExamTry();
    const second = createExamTry();

    first.getState().choose("q1", ["a"]);

    expect(second.getState().responses).toEqual({});
  });
});
