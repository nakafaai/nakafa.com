import { describe, expect, it } from "@effect/vitest";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";
import { assessmentSchema } from "@/lib/editor/assessment";
import { foldedDocument } from "@/lib/editor/fold";

/** The stored text of a document of one paragraph. */
const paragraph = (text: string) =>
  encodeJsonText({
    content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
    type: "doc",
  });

/** A stored step that writes text at a position. */
const insert = (at: number, text: string) =>
  encodeJsonText({
    from: at,
    slice: { content: [{ text, type: "text" }] },
    stepType: "replace",
    to: at,
  });

describe("editor/fold foldedDocument", () => {
  it.effect("applies every stored step after the snapshot, in order", () =>
    Effect.gen(function* () {
      const doc = yield* foldedDocument(assessmentSchema, {
        snapshot: { content: paragraph("Berapa"), version: 4 },
        steps: [
          { clientId: "rina", step: insert(7, " hasil"), version: 5 },
          { clientId: "hendra", step: insert(13, "?"), version: 6 },
        ],
      });
      expect(doc.textContent).toBe("Berapa hasil?");
    })
  );

  it.effect("returns the snapshot itself when no step follows it", () =>
    Effect.gen(function* () {
      const doc = yield* foldedDocument(assessmentSchema, {
        snapshot: { content: paragraph("2 + 3"), version: 0 },
        steps: [],
      });
      expect(doc.textContent).toBe("2 + 3");
    })
  );

  it.effect("refuses a snapshot that does not fit the schema", () =>
    Effect.gen(function* () {
      const failure = yield* foldedDocument(assessmentSchema, {
        snapshot: {
          content: encodeJsonText({ type: "chart" }),
          version: 0,
        },
        steps: [],
      }).pipe(Effect.flip);
      expect(failure._tag).toBe("SyncFailed");
    })
  );
});
