// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  readClassAddress,
  readCohortId,
  readDiscussionNumber,
  readExamId,
  readSittingId,
} from "@/lib/tenant/params";

describe("school path parameters", () => {
  it("decodes the exam, sitting and cohort addresses it is given", () => {
    expect(readExamId("exam-1")).toEqual(Option.some("exam-1"));
    expect(readSittingId("sitting-1")).toEqual(Option.some("sitting-1"));
    expect(readCohortId("cohort-1")).toEqual(Option.some("cohort-1"));
  });

  it("names no class for an address that is not a class address", () => {
    expect(readClassAddress("Not A Class!")).toEqual(Option.none());
  });

  it("reads a discussion's number, and none for an address that is not one", () => {
    expect(readDiscussionNumber("12")).toEqual(Option.some(12));
    expect(readDiscussionNumber("012")).toEqual(Option.none());
    expect(readDiscussionNumber("0")).toEqual(Option.none());
    expect(readDiscussionNumber("1.5")).toEqual(Option.none());
  });
});
