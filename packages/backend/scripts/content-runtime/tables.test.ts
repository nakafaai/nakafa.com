import contentReleaseSchema from "@repo/backend/convex/contentRelease/schema";
import routeSchema from "@repo/backend/convex/contents/schema/routes";
import { tryoutBundleSchema } from "@repo/backend/convex/tryouts/runtime/schema";
import {
  CONTENT_RUNTIME_CACHE_CONTRACT,
  CONTENT_RUNTIME_SCHEMA_FINGERPRINT,
  CONTENT_RUNTIME_TABLES,
  fingerprintRuntimeSchema,
  validateContentRuntimeTableDefinitions,
  validateRuntimeTableDefinitions,
} from "@repo/backend/scripts/content-runtime/tables";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const EXPECTED_RUNTIME_SCHEMA_FINGERPRINT =
  "cd5f66d090909b4fcb276711c6a52b54df8875ebb303d4c4d659c5b80b0e5609";

describe("content runtime tables", () => {
  it("derives the complete copy set and applies the active pointer last", () => {
    const releaseTables = Object.keys(contentReleaseSchema).filter(
      (table) =>
        table !== "contentState" &&
        table !== "contentCutoverActivity" &&
        table !== "contentCutoverState"
    );
    const expected = [
      ...releaseTables,
      ...Object.keys(tryoutBundleSchema),
      ...Object.keys(routeSchema),
      "contentState",
    ];

    expect(CONTENT_RUNTIME_TABLES).toEqual(expected);
    expect(CONTENT_RUNTIME_TABLES).not.toContain("contentCutoverState");
    expect(CONTENT_RUNTIME_TABLES).not.toContain("contentCutoverActivity");
    expect(new Set(CONTENT_RUNTIME_TABLES).size).toBe(expected.length);
    expect(Effect.runSync(validateContentRuntimeTableDefinitions)).toHaveLength(
      expected.length
    );
  });

  it("rejects duplicate table registrations before CI uses the fingerprint", () => {
    const table = defineTable({ value: v.string() });
    const failure = Effect.runSync(
      validateRuntimeTableDefinitions([
        ["duplicate", table],
        ["duplicate", table],
      ]).pipe(Effect.flip)
    );

    expect(failure).toMatchObject({
      _tag: "DuplicateContentRuntimeTableError",
      table: "duplicate",
    });
  });

  it("fingerprints the exact cache format and runtime table contracts", () => {
    expect(CONTENT_RUNTIME_CACHE_CONTRACT).toEqual({
      archive: {
        fixedEntries: ["manifest.jsonl", "metadata.json", "tables.txt"],
        tableEntryPattern: "<table>.jsonl",
        type: "tar-root-v1",
      },
      encryption: {
        cipher: "AES256",
        compression: "zlib",
        mode: "OpenPGP-OCB",
        s2kDigest: "SHA512",
        s2kMode: 3,
      },
      manifest: "ordered-json-lines-row-count-sha256-v1",
      portableRows: {
        encoding: "json-lines-v1",
        strippedFields: [
          "_id",
          "_creationTime",
          "proofWorkflowId",
          "syncJobId",
        ],
      },
      version: "signed-runtime-cache-v1",
    });
    expect(CONTENT_RUNTIME_SCHEMA_FINGERPRINT).toBe(
      EXPECTED_RUNTIME_SCHEMA_FINGERPRINT
    );
  });

  it("changes when a Convex validator or index changes", () => {
    const baseline = [["example", defineTable({ value: v.string() })]] as const;
    const changedValidator = [
      ["example", defineTable({ value: v.number() })],
    ] as const;
    const changedIndex = [
      [
        "example",
        defineTable({ value: v.string() }).index("by_value", ["value"]),
      ],
    ] as const;

    expect(fingerprintRuntimeSchema(changedValidator)).not.toBe(
      fingerprintRuntimeSchema(baseline)
    );
    expect(fingerprintRuntimeSchema(changedIndex)).not.toBe(
      fingerprintRuntimeSchema(baseline)
    );
  });

  it("changes when the runtime table order changes", () => {
    const first = defineTable({ value: v.string() });
    const second = defineTable({ value: v.number() });

    expect(
      fingerprintRuntimeSchema([
        ["first", first],
        ["second", second],
      ])
    ).not.toBe(
      fingerprintRuntimeSchema([
        ["second", second],
        ["first", first],
      ])
    );
  });
});
