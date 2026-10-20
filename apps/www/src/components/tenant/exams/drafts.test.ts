import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { createExamDrafts } from "@/components/tenant/exams/drafts";

const examId = Schema.decodeUnknownSync(Id("exams"));

describe("createExamDrafts", () => {
  it("lists the exams being saved in the order they started", () => {
    const drafts = createExamDrafts();

    drafts.getState().start(examId("draft-1"));
    drafts.getState().start(examId("draft-2"));

    expect(drafts.getState().ids).toEqual([
      examId("draft-1"),
      examId("draft-2"),
    ]);
  });

  it("ends the saving of one exam and keeps the others", () => {
    const drafts = createExamDrafts();
    drafts.getState().start(examId("draft-1"));
    drafts.getState().start(examId("draft-2"));

    drafts.getState().end(examId("draft-1"));

    expect(drafts.getState().ids).toEqual([examId("draft-2")]);
  });
});
