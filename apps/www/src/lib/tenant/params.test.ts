// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  readClassAddress,
  readCohortId,
  readDiscussionNumber,
  readExamId,
  readFolderAddress,
  readSittingId,
} from "@/lib/tenant/params";

/** An ID as Convex writes one. */
const DOCUMENT_ID = "k575t5zq8bvrb0ey01pq6m44en80zxvk";

describe("school path parameters", () => {
  it("decodes the exam, sitting, cohort and folder addresses that can name a row", () => {
    expect(readExamId(DOCUMENT_ID)).toEqual(Option.some(DOCUMENT_ID));
    expect(readSittingId(DOCUMENT_ID)).toEqual(Option.some(DOCUMENT_ID));
    expect(readCohortId(DOCUMENT_ID)).toEqual(Option.some(DOCUMENT_ID));
    expect(readFolderAddress(DOCUMENT_ID)).toEqual(Option.some(DOCUMENT_ID));
  });

  it("names no row for an address Convex would refuse as an ID", () => {
    expect(readExamId("not-an-exam")).toEqual(Option.none());
    expect(readSittingId("sitting")).toEqual(Option.none());
    expect(readCohortId(DOCUMENT_ID.toUpperCase())).toEqual(Option.none());
    expect(readFolderAddress(`${DOCUMENT_ID}iloqqqqq`)).toEqual(Option.none());
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
