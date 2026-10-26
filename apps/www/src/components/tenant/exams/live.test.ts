import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { OpenedDocument } from "@repo/backend/confect/editor/view";
import { encodeJsonText } from "@repo/utilities/json";
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

  it("keeps the newest document itself, even when an older one reads the same", () => {
    const live = createExamLive();
    const older = paragraph("Berapa");
    const newer = paragraph("Berapa");
    live.getState().show(first, older);
    live.getState().show(first, newer);

    expect(
      Option.getOrUndefined(HashMap.get(live.getState().docs, first))
    ).toBe(newer);
  });

  it("gives each editor its own documents", () => {
    const one = createExamLive();
    const other = createExamLive();
    one.getState().show(first, paragraph("Berapa"));
    expect(HashMap.size(other.getState().docs)).toBe(0);
  });

  /** A prompt as the editor's loader reads it: a snapshot of `content` and no steps after it. */
  const loaded = (content: string) => ({
    documentId: first,
    opened: Schema.decodeSync(OpenedDocument)({
      client: null,
      snapshot: { content, version: 0 },
      steps: [],
    }),
  });

  it("starts from the prompt the loader read, until the prompt's editor holds its own", () => {
    const live = createExamLive(
      loaded(encodeJsonText(paragraph("Berapa hasil 2 + 3?").toJSON()))
    );
    expect(
      Option.map(
        HashMap.get(live.getState().docs, first),
        (doc) => doc.textContent
      )
    ).toEqual(Option.some("Berapa hasil 2 + 3?"));

    const held = paragraph("Berapa hasil 3 + 4?");
    live.getState().show(first, held);
    expect(
      Option.getOrUndefined(HashMap.get(live.getState().docs, first))
    ).toBe(held);
  });

  it("starts from nothing when the loaded prompt does not fit the schema", () => {
    const live = createExamLive(
      loaded(encodeJsonText({ content: [{ type: "unknown" }], type: "doc" }))
    );
    expect(HashMap.size(live.getState().docs)).toBe(0);
  });
});
