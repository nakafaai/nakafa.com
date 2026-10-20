import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { titleToSave } from "@/components/tenant/exams/title";

describe("titleToSave", () => {
  it("sends nothing while the teacher has typed nothing", () => {
    expect(titleToSave(null, "PTS Matematika")).toEqual(Option.none());
  });

  it("sends the trimmed title when it differs from the saved one", () => {
    expect(titleToSave("  UAS Fisika ", "PTS Matematika")).toEqual(
      Option.some("UAS Fisika")
    );
  });

  it("sends nothing when the trimmed title is the saved one", () => {
    expect(titleToSave("  PTS Matematika ", "PTS Matematika")).toEqual(
      Option.none()
    );
  });

  it("sends nothing for a blank title, which the contract refuses", () => {
    expect(titleToSave("   ", "PTS Matematika")).toEqual(Option.none());
  });
});
