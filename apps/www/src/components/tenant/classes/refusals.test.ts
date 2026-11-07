import { describe, expect, it } from "@effect/vitest";
import { classRefusalCopy } from "@/components/tenant/classes/refusals";

describe("class refusals", () => {
  it("names each refusal by its own copy, and anything else by the generic copy", () => {
    expect([
      classRefusalCopy({ _tag: "QuestionsUnready" }),
      classRefusalCopy({ _tag: "ScheduleInvalid" }),
      classRefusalCopy({ _tag: "SomethingElse" }),
      classRefusalCopy({ _tag: 7 }),
      classRefusalCopy(new Error("offline")),
    ]).toEqual([
      {
        description: "classroom-refusal-questions-unready.description",
        title: "classroom-refusal-questions-unready.title",
      },
      {
        description: "school-refusal-schedule-invalid.description",
        title: "school-refusal-schedule-invalid.title",
      },
      { description: "action-error.description", title: "action-error.title" },
      { description: "action-error.description", title: "action-error.title" },
      { description: "action-error.description", title: "action-error.title" },
    ]);
  });
});
