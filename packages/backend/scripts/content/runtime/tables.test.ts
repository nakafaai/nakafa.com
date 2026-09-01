import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import contentReleaseSchema from "@repo/backend/convex/contentRelease/schema";
import { tryoutRuntimeBundleSchema } from "@repo/backend/convex/tryouts/runtime/schema";
import {
  CONTENT_RUNTIME_CACHE_CONTRACT,
  CONTENT_RUNTIME_TABLES,
  fingerprintRuntimeSchema,
  readContentRuntimeContractIdentity,
  readContentRuntimeSchemaFingerprint,
  validateContentRuntimeTableDefinitions,
  validateRuntimeTableDefinitions,
} from "@repo/backend/scripts/content/runtime/tables";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const EXPECTED_RUNTIME_SCHEMA_FINGERPRINT =
  "da8900581109fa63df971285e4cb75d7ee86a325b71a206d8020502d698e490a";
const DECODER_CONTRACT_IDENTITY = {
  name: "@nakafa/aksara-contracts" as const,
  version: "0.33.0",
};

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
          ...Object.keys(tryoutRuntimeBundleSchema),
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

  it.live(
    "fingerprints the exact cache format, decoder, and runtime tables",
    () =>
      Effect.gen(function* () {
        expect(CONTENT_RUNTIME_CACHE_CONTRACT).toEqual({
          archive: {
            fixedEntries: ["manifest.jsonl", "metadata.json", "tables.txt"],
            tableEntryPattern: "<table>.jsonl",
            type: "tar-root",
          },
          encryption: {
            cipher: "AES256",
            compression: "zlib",
            mode: "OpenPGP-OCB",
            s2kDigest: "SHA512",
            s2kMode: 3,
          },
          manifest: "ordered-json-lines-row-count-sha256",
          portableRows: {
            encoding: "json-lines",
            strippedFields: [
              "_id",
              "_creationTime",
              "proofWorkflowId",
              "syncJobId",
            ],
          },
        });
        expect(yield* readContentRuntimeContractIdentity()).toEqual(
          DECODER_CONTRACT_IDENTITY
        );
        expect(yield* readContentRuntimeSchemaFingerprint()).toBe(
          EXPECTED_RUNTIME_SCHEMA_FINGERPRINT
        );
      }).pipe(Effect.provide(NodeServices.layer))
  );

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

    expect(
      fingerprintRuntimeSchema(changedValidator, DECODER_CONTRACT_IDENTITY)
    ).not.toBe(fingerprintRuntimeSchema(baseline, DECODER_CONTRACT_IDENTITY));
    expect(
      fingerprintRuntimeSchema(changedIndex, DECODER_CONTRACT_IDENTITY)
    ).not.toBe(fingerprintRuntimeSchema(baseline, DECODER_CONTRACT_IDENTITY));
  });

  it("changes when the external decoder package changes", () => {
    const tables = [["example", defineTable({ value: v.string() })]] as const;

    expect(
      fingerprintRuntimeSchema(tables, {
        ...DECODER_CONTRACT_IDENTITY,
        version: "0.34.0",
      })
    ).not.toBe(fingerprintRuntimeSchema(tables, DECODER_CONTRACT_IDENTITY));
  });

  it("changes when the runtime table order changes", () => {
    const first = defineTable({ value: v.string() });
    const second = defineTable({ value: v.number() });

    expect(
      fingerprintRuntimeSchema(
        [
          ["first", first],
          ["second", second],
        ],
        DECODER_CONTRACT_IDENTITY
      )
    ).not.toBe(
      fingerprintRuntimeSchema(
        [
          ["second", second],
          ["first", first],
        ],
        DECODER_CONTRACT_IDENTITY
      )
    );
  });
});
