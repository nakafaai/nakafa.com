import { describe, expect, it } from "@effect/vitest";
import {
  AssessmentDocumentSchema,
  MAX_DOCUMENT_DEPTH,
} from "@nakafa/aksara-contracts/assessment/document";
import {
  type Document,
  DocumentSchema,
  DocumentTextSchema,
  encodeDocument,
  storedDocument,
} from "@repo/backend/confect/editor/document";
import type { DocumentNode } from "@repo/backend/confect/editor/node";
import {
  CONVEX_DOCUMENT_LIMIT,
  MAX_DOCUMENT_BYTES,
} from "@repo/backend/confect/editor/size";
import {
  documentOf,
  nestedAttrs,
  paragraphOf,
} from "@repo/backend/test/editor/nodes";
import { encodeJsonText } from "@repo/utilities/json";
import { utf8Bytes } from "@repo/utilities/text";
import { getDocumentSize } from "convex/values";
import { Effect, Schema } from "effect";

/** A document of the kinds the editor writes: a heading, marked text, a bullet list and a code block. */
const sample: Document = {
  content: [
    {
      attrs: { level: 2 },
      content: [{ text: "Judul", type: "text" }],
      type: "heading",
    },
    {
      content: [
        { marks: [{ type: "bold" }], text: "Tebal", type: "text" },
        { text: " dan biasa", type: "text" },
      ],
      type: "paragraph",
    },
    {
      content: [
        {
          content: [
            {
              content: [{ text: "Butir", type: "text" }],
              type: "paragraph",
            },
          ],
          type: "listItem",
        },
      ],
      type: "bulletList",
    },
    {
      attrs: { language: "ts" },
      content: [{ text: "const a = 1", type: "text" }],
      type: "codeBlock",
    },
  ],
  type: "doc",
};

describe("editor/document storage form", () => {
  it.effect(
    "writes a document as JSON text and reads the same document back",
    () =>
      Effect.gen(function* () {
        const text = yield* encodeDocument(sample);
        expect(yield* Schema.decodeEffect(DocumentTextSchema)(text)).toEqual(
          sample
        );
      })
  );

  it.effect(
    "refuses a document with no content, which ProseMirror never writes",
    () =>
      Effect.gen(function* () {
        const failure = yield* Schema.decodeEffect(DocumentSchema)({
          content: [],
          type: "doc",
        }).pipe(Effect.flip);
        expect(failure._tag).toBe("SchemaError");
      })
  );

  it.effect(
    "refuses an empty text node on write, as ProseMirror refuses it",
    () =>
      Effect.gen(function* () {
        const failure = yield* encodeDocument(paragraphOf("")).pipe(
          Effect.flip
        );
        expect(failure._tag).toBe("SchemaError");
      })
  );

  it.effect("refuses a text node with no text on read", () =>
    Effect.gen(function* () {
      const failure = yield* Schema.decodeEffect(DocumentTextSchema)(
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text"}]}]}'
      ).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
    })
  );

  it.effect("stores a document exactly at the depth bound", () =>
    Effect.gen(function* () {
      const text = yield* encodeDocument(documentOf(MAX_DOCUMENT_DEPTH));
      expect(yield* Schema.decodeEffect(DocumentTextSchema)(text)).toEqual(
        documentOf(MAX_DOCUMENT_DEPTH)
      );
    })
  );

  it.effect("refuses one level deeper on write and names the depth bound", () =>
    Effect.gen(function* () {
      const failure = yield* encodeDocument(
        documentOf(MAX_DOCUMENT_DEPTH + 1)
      ).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
      expect(failure.message).toContain(
        `at most ${MAX_DOCUMENT_DEPTH} levels deep`
      );
    })
  );

  it.effect(
    "refuses a stored text nested deeper than the bound before it reads a node",
    () =>
      Effect.gen(function* () {
        // Written out as text, so the parser reads 1,000 levels and only the depth bound can refuse them.
        const levels = 1000;
        const open = '{"type":"blockquote","content":['.repeat(levels);
        const close = "]}".repeat(levels);
        const text = `{"type":"doc","content":[${open}{"type":"text","text":"x"}${close}]}`;
        const failure = yield* Schema.decodeEffect(DocumentTextSchema)(
          text
        ).pipe(Effect.flip);
        expect(failure._tag).toBe("SchemaError");
        expect(failure.message).toContain(
          `at most ${MAX_DOCUMENT_DEPTH} levels deep`
        );
      })
  );

  it.effect(
    "refuses a document of 100,000 levels as a schema issue, not a stack overflow",
    () =>
      Effect.gen(function* () {
        const failure = yield* Schema.decodeEffect(DocumentSchema)(
          documentOf(100_000)
        ).pipe(Effect.flip);
        expect(failure._tag).toBe("SchemaError");
      })
  );

  it.effect(
    "refuses a typed document of 100,000 levels on write as a schema issue, not a stack overflow",
    () =>
      Effect.gen(function* () {
        const failure = yield* encodeDocument(documentOf(100_000)).pipe(
          Effect.flip
        );
        expect(failure._tag).toBe("SchemaError");
      })
  );

  it.effect(
    "refuses attributes of the document or of a node nested deeper than the bound",
    () =>
      Effect.gen(function* () {
        const deep = nestedAttrs(MAX_DOCUMENT_DEPTH + 1);
        const paragraph: DocumentNode = {
          content: [{ text: "x", type: "text" }],
          type: "paragraph",
        };
        const rootAttrs: Document = {
          attrs: deep,
          content: [paragraph],
          type: "doc",
        };
        const nodeAttrs: Document = {
          content: [{ ...paragraph, attrs: deep }],
          type: "doc",
        };
        const rootWrite = yield* encodeDocument(rootAttrs).pipe(Effect.flip);
        const nodeWrite = yield* encodeDocument(nodeAttrs).pipe(Effect.flip);
        expect(rootWrite.message).toContain(
          `at most ${MAX_DOCUMENT_DEPTH} levels deep`
        );
        expect(nodeWrite.message).toContain(
          `at most ${MAX_DOCUMENT_DEPTH} levels deep`
        );

        const deepText =
          '{"a":'.repeat(MAX_DOCUMENT_DEPTH) +
          "{}" +
          "}".repeat(MAX_DOCUMENT_DEPTH);
        const rootRead = yield* Schema.decodeEffect(DocumentTextSchema)(
          `{"attrs":${deepText},"content":[{"content":[{"text":"x","type":"text"}],"type":"paragraph"}],"type":"doc"}`
        ).pipe(Effect.flip);
        const nodeRead = yield* Schema.decodeEffect(DocumentTextSchema)(
          `{"content":[{"attrs":${deepText},"content":[{"text":"x","type":"text"}],"type":"paragraph"}],"type":"doc"}`
        ).pipe(Effect.flip);
        expect(rootRead._tag).toBe("SchemaError");
        expect(nodeRead._tag).toBe("SchemaError");
      })
  );

  it.effect(
    "stores the largest text whose row stays under the Convex limit and refuses one byte more",
    () =>
      Effect.gen(function* () {
        const base = utf8Bytes(yield* encodeDocument(paragraphOf("x"))) - 1;
        const room = MAX_DOCUMENT_BYTES - base;
        const stored = yield* encodeDocument(paragraphOf("x".repeat(room)));
        expect(utf8Bytes(stored)).toBe(MAX_DOCUMENT_BYTES);
        expect(getDocumentSize({ text: stored })).toBeLessThan(
          CONVEX_DOCUMENT_LIMIT
        );
        expect(getDocumentSize({ text: `${stored} ` })).toBe(
          CONVEX_DOCUMENT_LIMIT
        );
        const refused = yield* encodeDocument(
          paragraphOf("x".repeat(room + 1))
        ).pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "DocumentTooLarge",
          bytes: MAX_DOCUMENT_BYTES + 1,
          limit: MAX_DOCUMENT_BYTES,
        });
      })
  );

  it.effect(
    "counts UTF-8 bytes, so two-byte characters reach the bound sooner than characters would",
    () =>
      Effect.gen(function* () {
        const base = utf8Bytes(yield* encodeDocument(paragraphOf("x"))) - 1;
        const room = MAX_DOCUMENT_BYTES - base;
        const stored = yield* encodeDocument(
          paragraphOf("é".repeat(Math.floor(room / 2)))
        );
        expect(utf8Bytes(stored)).toBeLessThanOrEqual(MAX_DOCUMENT_BYTES);
        const refused = yield* encodeDocument(
          paragraphOf("é".repeat(Math.floor(room / 2) + 1))
        ).pipe(Effect.flip);
        expect(refused._tag).toBe("DocumentTooLarge");
      })
  );
});

describe("editor/document snapshot", () => {
  it.effect(
    "refuses a snapshot with a node the editor does not read, though the contract accepts that node",
    () =>
      Effect.gen(function* () {
        const text = encodeJsonText({
          content: [{ attrs: { latex: "x" }, type: "mathBlock" }],
          type: "doc",
        });
        // The contract accepts this text, so the refusal below comes from the types the editor reads.
        yield* Schema.decodeEffect(
          Schema.fromJsonString(AssessmentDocumentSchema)
        )(text);
        const failure = yield* storedDocument(text).pipe(Effect.flip);
        expect(failure._tag).toBe("DocumentInvalid");
      })
  );

  it.effect(
    "refuses a snapshot whose heading level the contract refuses, though the editor reads headings",
    () =>
      Effect.gen(function* () {
        const headingAt = (level: number) =>
          encodeJsonText({
            content: [
              {
                attrs: { level },
                content: [{ text: "x", type: "text" }],
                type: "heading",
              },
            ],
            type: "doc",
          });
        // The level-2 heading is stored, so the refusal of level 4 comes from the contract's own level check.
        yield* storedDocument(headingAt(2));
        const failure = yield* storedDocument(headingAt(4)).pipe(Effect.flip);
        expect(failure._tag).toBe("DocumentInvalid");
      })
  );
});
