import contentReleaseSchema from "@repo/backend/convex/contentRelease/schema";
import { tryoutBundleSchema } from "@repo/backend/convex/tryouts/runtime/schema";
import {
  CONTENT_RUNTIME_CACHE_CONTRACT,
  CONTENT_RUNTIME_SCHEMA_FINGERPRINT,
  CONTENT_RUNTIME_TABLES,
  fingerprintRuntimeSchema,
  validateContentRuntimeTableDefinitions,
  validateRuntimeTableDefinitions,
} from "@repo/backend/scripts/content-runtime/tables";
import { describe, expect, it } from "@repo/testing/effect";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const EXPECTED_RUNTIME_SCHEMA_FINGERPRINT =
  "7e295b44afd36021e43ab032333659f9cd24c6689efe017b4c6b86caa19ba511";

describe("content runtime tables", () => {
  it.live(
    "derives the complete copy set and applies the active pointer last",
    () =>
      Effect.gen(function* () {
        const releaseTables = Object.keys(contentReleaseSchema).filter(
          (table) => table !== "contentState"
        );
        const expected = [
          ...releaseTables,
          ...Object.keys(tryoutBundleSchema),
          "contentState",
        ];

        expect(CONTENT_RUNTIME_TABLES).toEqual(expected);
        expect(new Set(CONTENT_RUNTIME_TABLES).size).toBe(expected.length);
        expect(yield* validateContentRuntimeTableDefinitions).toHaveLength(
          expected.length
        );
      })
  );

  it.live(
    "rejects duplicate table registrations before CI uses the fingerprint",
    () =>
      Effect.gen(function* () {
        const table = defineTable({ value: v.string() });
        const failure = yield* validateRuntimeTableDefinitions([
          ["duplicate", table],
          ["duplicate", table],
        ]).pipe(Effect.flip);

        expect(failure).toMatchObject({
          _tag: "DuplicateContentRuntimeTableError",
          table: "duplicate",
        });
      })
  );

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
      version: "signed-runtime-cache-v2",
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
