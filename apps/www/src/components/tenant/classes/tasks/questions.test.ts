import { describe, expect, it } from "@effect/vitest";
import {
  examOfChoice,
  WRITTEN,
} from "@/components/tenant/classes/tasks/questions";

describe("task questions", () => {
  it("publishes a written task with no exam, and an exam task with the chosen exam", () => {
    expect([examOfChoice(WRITTEN), examOfChoice("k57exam1")]).toEqual([
      null,
      "k57exam1",
    ]);
  });
});
