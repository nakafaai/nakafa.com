import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { refusalCopyOf } from "@/components/exams/sitting/refusal";

describe("refusalCopyOf", () => {
  it("names the reason and the next step of each refusal of an answer or a finish", () => {
    expect(refusalCopyOf({ _tag: "AttemptClosed" })).toEqual(
      Option.some({
        description: "sitting-attempt-closed.description",
        title: "sitting-attempt-closed.title",
      })
    );
    expect(refusalCopyOf({ _tag: "AttemptLocked" })).toEqual(
      Option.some({
        description: "sitting-attempt-locked.description",
        title: "sitting-attempt-locked.title",
      })
    );
    expect(refusalCopyOf({ _tag: "ResponseDoesNotFit" })).toEqual(
      Option.some({
        description: "sitting-response-refused.description",
        title: "sitting-response-refused.title",
      })
    );
  });

  it("names no copy for an error that a refusal does not name", () => {
    expect(refusalCopyOf({ _tag: "AccessDenied" })).toEqual(Option.none());
    expect(refusalCopyOf(new Error("network"))).toEqual(Option.none());
  });
});
