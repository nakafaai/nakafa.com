import { describe, expect, it } from "@effect/vitest";
import { createFlagStore } from "@/components/exams/sitting/flags";

describe("createFlagStore", () => {
  it("starts from the flags the browser kept", () => {
    const store = createFlagStore({ flagged: ["q1"], keep: vi.fn() });
    expect(store.getState().flagged).toEqual(["q1"]);
  });

  it("flags a question, keeps the change, and unflags it on the next toggle", () => {
    const keep = vi.fn<(questionId: string, flagged: boolean) => void>();
    const store = createFlagStore({ flagged: [], keep });

    store.getState().toggle("q2");
    expect(store.getState().flagged).toEqual(["q2"]);
    expect(keep).toHaveBeenLastCalledWith("q2", true);

    store.getState().toggle("q2");
    expect(store.getState().flagged).toEqual([]);
    expect(keep).toHaveBeenLastCalledWith("q2", false);
  });
});
