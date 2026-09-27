import { assert, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { decodeSnapshotRowJson } from "@repo/backend/confect/contentRelease/parse";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { Effect, Schema } from "effect";

const page = refs.public.contentRelease.program.page;
const initial = {
  appLocale: "en",
  expectedManifestHash: null,
  expectedReleaseId: null,
  paginationOpts: { cursor: null, numItems: 1 },
} as const;
const current = {
  ...initial,
  expectedManifestHash: TEST_MANIFEST_HASH,
  expectedReleaseId: TEST_RELEASE_ID,
};

describe("contentRelease/program/page", () => {
  it.effect(
    "rejects malformed, foreign-snapshot, and cross-locale curriculum cursors",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        yield* confect.run(
          activateProgramSnapshot(yield* makeProgramSnapshotData())
        );
        const first = yield* confect.query(page, initial);
        for (const cursor of [
          "program-route|{",
          'program-route|["foreign-snapshot","en","/en/programs/technical-program-0"]',
        ]) {
          expect(
            yield* confect
              .query(page, {
                ...current,
                paginationOpts: { cursor, numItems: 1 },
              })
              .pipe(Effect.flip)
          ).toMatchObject({
            _tag: "ReleaseError",
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        }
        expect(
          yield* confect
            .query(page, {
              ...current,
              appLocale: "de",
              paginationOpts: {
                cursor: first.result.continueCursor,
                numItems: 1,
              },
            })
            .pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ReleaseError",
          code: "CONTENT_RELEASE_INTEGRITY",
        });
      }).pipe(Effect.provide(confectLayer))
  );
  it.effect("returns an empty unmanaged page before program publication", () =>
    Effect.gen(function* () {
      const confect = yield* Confect;
      expect(yield* confect.query(page, initial)).toMatchObject({
        managed: false,
        result: { isDone: true, page: [] },
      });
    }).pipe(Effect.provide(confectLayer))
  );
  it.effect(
    "paginates verified localized routes under one release identity",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        const data = yield* makeProgramSnapshotData();
        yield* confect.run(activateProgramSnapshot(data));
        const first = yield* confect.query(page, initial);
        const firstJson = first.result.page[0];
        assert(firstJson);
        const firstRow = yield* decodeSnapshotRowJson(firstJson);
        expect(first).toMatchObject({
          activeManifestHash: TEST_MANIFEST_HASH,
          activeReleaseId: TEST_RELEASE_ID,
          managed: true,
          result: { isDone: false },
          snapshotId: data.snapshotId,
          sourceRevision: "a".repeat(40),
          stale: false,
        });
        expect(firstRow).toMatchObject({
          family: "program",
          record: { kind: "curriculum", row: { appLocale: "en" } },
        });
        const second = yield* confect.query(page, {
          ...current,
          paginationOpts: { cursor: first.result.continueCursor, numItems: 1 },
        });
        expect(second).toMatchObject({
          managed: true,
          result: { isDone: true, page: [expect.any(String)] },
          stale: false,
        });
        expect(second.result.page[0]).not.toBe(firstJson);
      }).pipe(Effect.provide(confectLayer))
  );
  it.effect(
    "returns a stable stale page for a superseded continuation identity",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        yield* confect.run(
          activateProgramSnapshot(yield* makeProgramSnapshotData())
        );
        const first = yield* confect.query(page, initial);
        expect(
          yield* confect.query(page, {
            ...initial,
            expectedManifestHash: "stale-manifest",
            expectedReleaseId: "stale-release",
            paginationOpts: {
              cursor: first.result.continueCursor,
              numItems: 1,
            },
          })
        ).toMatchObject({
          activeReleaseId: TEST_RELEASE_ID,
          managed: true,
          result: { isDone: true, page: [] },
          stale: true,
        });
      }).pipe(Effect.provide(confectLayer))
  );
  it.effect(
    "resumes an issued native cursor without repeating the preceding route",
    () =>
      Effect.gen(function* () {
        const confect = yield* Confect;
        const data = yield* makeProgramSnapshotData();
        yield* confect.run(activateProgramSnapshot(data));
        const issued = yield* confect.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const result = yield* reader
              .table("curriculumRoutes")
              .index("by_snapshotId_and_appLocale_and_path", (index) =>
                index.eq("snapshotId", data.snapshotId).eq("appLocale", "en")
              )
              .paginate({ cursor: null, numItems: 1 });
            expect(result.isDone).toBe(false);
            const row = result.page[0];
            assert(row);
            return { cursor: result.continueCursor, rowJson: row.rowJson };
          }),
          Schema.Struct({ cursor: Schema.String, rowJson: Schema.String })
        );
        const next = yield* confect.query(page, {
          ...current,
          paginationOpts: { cursor: issued.cursor, numItems: 1 },
        });
        expect(next).toMatchObject({
          managed: true,
          stale: false,
          result: { isDone: true, page: [expect.any(String)] },
        });
        expect(next.result.page[0]).not.toBe(issued.rowJson);
      }).pipe(Effect.provide(confectLayer))
  );
});
