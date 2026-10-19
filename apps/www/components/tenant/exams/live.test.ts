import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { HashMap, Option, Schema } from "effect";
import { createExamLive } from "@/components/tenant/exams/live";
import { assessmentSchema } from "@/lib/editor/assessment";

const promptId = Schema.decodeUnknownSync(Id("editorDocuments"));
const first = promptId("first");
const second = promptId("second");

/** A document of one paragraph. */
const paragraph = (text: string) =>
  assessmentSchema.node("doc", null, [
    assessmentSchema.node("paragraph", null, [assessmentSchema.text(text)]),
  ]);

describe("tenant/exams/live createExamLive", () => {
  it("keeps the latest document of each prompt, apart from the others", () => {
    const live = createExamLive();
    live.getState().show(first, paragraph("Berapa"));
    live.getState().show(second, paragraph("2 + 3"));
    live.getState().show(first, paragraph("Berapa hasil?"));

    const docs = live.getState().docs;
    expect(HashMap.size(docs)).toBe(2);
    expect(
      Option.map(HashMap.get(docs, first), (doc) => doc.textContent)
    ).toEqual(Option.some("Berapa hasil?"));
    expect(
      Option.map(HashMap.get(docs, second), (doc) => doc.textContent)
    ).toEqual(Option.some("2 + 3"));
  });

  it("gives each editor its own documents", () => {
    const one = createExamLive();
    const other = createExamLive();
    one.getState().show(first, paragraph("Berapa"));
    expect(HashMap.size(other.getState().docs)).toBe(0);
  });
});
