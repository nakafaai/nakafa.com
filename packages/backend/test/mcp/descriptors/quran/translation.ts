import {
  NON_NEGATIVE_INTEGER,
  POSITIVE_INTEGER,
} from "@repo/backend/test/mcp/descriptors/quran/field";

/** The notes of a translation: each numbered note sits at an offset of the reference text. */
const NOTES = {
  type: "array",
  items: {
    type: "object",
    properties: {
      number: POSITIVE_INTEGER,
      referenceOffset: NON_NEGATIVE_INTEGER,
      text: { type: "string" },
    },
    required: ["number", "referenceOffset", "text"],
    additionalProperties: true,
  },
};

/** The segments of a translation: text, and the points where a note is referenced. */
const SEGMENTS = {
  type: "array",
  items: {
    anyOf: [
      {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["text"] },
          offset: NON_NEGATIVE_INTEGER,
          value: { type: "string" },
        },
        required: ["kind", "offset", "value"],
        additionalProperties: true,
      },
      {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["note"] },
          number: POSITIVE_INTEGER,
          offset: NON_NEGATIVE_INTEGER,
        },
        required: ["kind", "number", "offset"],
        additionalProperties: true,
      },
    ],
  },
};

/** A reviewed translation with its notes and segments. The caller states what it translates. */
export function translation(description: string) {
  return {
    type: "object",
    properties: {
      notes: NOTES,
      segments: SEGMENTS,
    },
    required: ["notes", "segments"],
    additionalProperties: true,
    description,
  };
}
