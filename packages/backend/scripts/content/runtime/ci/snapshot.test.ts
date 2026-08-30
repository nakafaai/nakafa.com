import { describe, expect, it } from "@effect/vitest";
import {
  CONTENT_RUNTIME_CACHE_DIRECTORY,
  CONTENT_RUNTIME_CACHE_FILE,
  createPortableTable,
  decodeAndValidateManifest,
  formatManifest,
  formatMetadata,
  getExpectedArchiveEntries,
  validateArchiveListing,
  validateMetadata,
  validatePortableTable,
} from "@repo/backend/scripts/content/runtime/ci/snapshot";
import { CONTENT_RUNTIME_TABLES } from "@repo/backend/scripts/content/runtime/tables";
import { Effect } from "effect";

const identity = {
  contentStateHash: "1".repeat(64),
  runtimeSchemaFingerprint: "3".repeat(64),
};

describe("content runtime snapshot", () => {
  it.live(
    "keeps only portable fields and records exact integrity metadata",
    () =>
      Effect.gen(function* () {
        const portable = createPortableTable("example", [
          {
            _creationTime: 1,
            _id: "row-1",
            proofWorkflowId: "workflow-1",
            syncJobId: "job-1",
            value: "safe",
          },
        ]);

        expect(portable.jsonLines).toBe('{"value":"safe"}\n');
        expect(portable.entry).toMatchObject({ rowCount: 1, table: "example" });
        yield* validatePortableTable(portable.entry, portable.jsonLines);
      })
  );

  it.live("validates exact metadata, table order, counts, and hashes", () =>
    Effect.gen(function* () {
      const entries = CONTENT_RUNTIME_TABLES.map(
        (table) => createPortableTable(table, []).entry
      );
      const manifest = yield* decodeAndValidateManifest(
        formatManifest(entries)
      );

      yield* validateMetadata(formatMetadata(identity), identity);
      expect(manifest).toEqual(entries);
    })
  );

  it.live("rejects obsolete versioned metadata", () =>
    Effect.gen(function* () {
      const failure = yield* validateMetadata(
        `${JSON.stringify({ ...identity, cacheVersion: "v2" })}\n`,
        identity
      ).pipe(Effect.flip);

      expect(failure).toMatchObject({
        _tag: "ContentRuntimeCiError",
        message: "Signed runtime metadata is invalid.",
      });
    })
  );

  it.live("rejects tampering and unsafe archive members", () =>
    Effect.gen(function* () {
      const portable = createPortableTable("example", [{ value: "safe" }]);
      const integrityFailure = yield* validatePortableTable(
        portable.entry,
        '{"value":"changed"}\n'
      ).pipe(Effect.flip);
      const expectedArchive = getExpectedArchiveEntries();
      const verbose = expectedArchive
        .map((entry) => `${entry === "./" ? "d" : "-"}--------- ${entry}`)
        .join("\n");
      const unsafeArchive = yield* validateArchiveListing(
        `${expectedArchive.join("\n")}\n./unexpected\n`,
        verbose
      ).pipe(Effect.flip);

      expect(integrityFailure).toMatchObject({ _tag: "ContentRuntimeCiError" });
      expect(unsafeArchive).toMatchObject({ _tag: "ContentRuntimeCiError" });
    })
  );

  it("uses one dedicated encrypted cache path", () => {
    expect(
      `${CONTENT_RUNTIME_CACHE_DIRECTORY}/${CONTENT_RUNTIME_CACHE_FILE}`
    ).toBe("agent-docs-content-cache/runtime.tar.gpg");
  });
});
