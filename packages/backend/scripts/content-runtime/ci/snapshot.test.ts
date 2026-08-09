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
} from "@repo/backend/scripts/content-runtime/ci/snapshot";
import { CONTENT_RUNTIME_TABLES } from "@repo/backend/scripts/content-runtime/tables";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const identity = {
  cacheVersion: "v1",
  contentStateHash: "1".repeat(64),
  routeGenerationHash: "2".repeat(64),
  runtimeSchemaFingerprint: "3".repeat(64),
  sitemapGenerationHash: "4".repeat(64),
};

describe("content runtime snapshot", () => {
  it("keeps only portable fields and records exact integrity metadata", async () => {
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
    await Effect.runPromise(
      validatePortableTable(portable.entry, portable.jsonLines)
    );
  });

  it("validates exact metadata, table order, counts, and hashes", async () => {
    const entries = CONTENT_RUNTIME_TABLES.map(
      (table) => createPortableTable(table, []).entry
    );
    const manifest = await Effect.runPromise(
      decodeAndValidateManifest(formatManifest(entries))
    );

    await Effect.runPromise(
      validateMetadata(formatMetadata(identity), identity)
    );
    expect(manifest).toEqual(entries);
  });

  it("rejects tampering and unsafe archive members", async () => {
    const portable = createPortableTable("example", [{ value: "safe" }]);
    const integrityFailure = await Effect.runPromise(
      validatePortableTable(portable.entry, '{"value":"changed"}\n').pipe(
        Effect.flip
      )
    );
    const expectedArchive = getExpectedArchiveEntries();
    const verbose = expectedArchive
      .map((entry) => `${entry === "./" ? "d" : "-"}--------- ${entry}`)
      .join("\n");
    const unsafeArchive = await Effect.runPromise(
      validateArchiveListing(
        `${expectedArchive.join("\n")}\n./unexpected\n`,
        verbose
      ).pipe(Effect.flip)
    );

    expect(integrityFailure).toMatchObject({ _tag: "ContentRuntimeCiError" });
    expect(unsafeArchive).toMatchObject({ _tag: "ContentRuntimeCiError" });
  });

  it("uses one dedicated encrypted cache path", () => {
    expect(
      `${CONTENT_RUNTIME_CACHE_DIRECTORY}/${CONTENT_RUNTIME_CACHE_FILE}`
    ).toBe("agent-docs-content-cache/runtime.tar.gpg");
  });
});
