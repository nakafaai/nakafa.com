import { describe, expect, it } from "@effect/vitest";
import { decodeSnapshotRowJson } from "@repo/backend/confect/contentRelease/parse";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { programLayer } from "@repo/backend/content/program/confect";
import { readProgramRoute } from "@repo/backend/content/program/route";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import {
  insertCurriculumRoutes,
  insertMaterialGroups,
  materialContext,
  materialGroup,
  PROGRAM_ROOT,
  tamperCurriculumRoute,
} from "@repo/backend/test/program/route";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { Effect } from "effect";

describe("contentRelease/program/route", () => {
  it.effect(
    "returns one exact verified route and its program provenance",
    Effect.fn("contentRelease.program.route.test.returnsExactRoute")(
      function* () {
        const data = yield* makeProgramSnapshotData();
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            yield* activateProgramSnapshot(data);
            const result = yield* readProgramRoute(
              "en",
              "curriculum/technical-program-1"
            ).pipe(Effect.provide(programLayer));
            const [program, route] = yield* Effect.all([
              decodeSnapshotRowJson(result.programJson ?? ""),
              decodeSnapshotRowJson(result.routeJson ?? ""),
            ]);
            expect(result).toMatchObject({
              activeManifestHash: TEST_MANIFEST_HASH,
              activeReleaseId: TEST_RELEASE_ID,
              ancestorJson: [],
              childJson: [],
              contextJson: [],
              groupJson: [],
              managed: true,
              materialJson: [],
              snapshotId: data.snapshotId,
              sourceRevision: "a".repeat(40),
            });
            expect(program).toMatchObject({
              family: "program",
              record: {
                kind: "program",
                row: {
                  key: "technical-program-1",
                },
              },
            });
            expect(route).toMatchObject({
              family: "program",
              record: {
                kind: "curriculum",
                row: {
                  appLocale: "en",
                  programKey: "technical-program-1",
                },
              },
            });
          })
        );
      }
    )
  );
  it.effect(
    "distinguishes a managed missing route from an unmanaged source",
    Effect.fn("contentRelease.program.route.test.distinguishesMissingRoute")(
      function* () {
        const data = yield* makeProgramSnapshotData();
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            yield* activateProgramSnapshot(data);
            const result = yield* readProgramRoute(
              "id",
              "kurikulum/missing"
            ).pipe(Effect.provide(programLayer));
            expect(result).toMatchObject({
              managed: true,
              programJson: null,
              routeJson: null,
            });
          })
        );
      }
    )
  );
  it.effect(
    "preserves the active release while programs remain source-owned",
    Effect.fn("contentRelease.program.route.test.preservesActiveRelease")(
      function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            yield* activateMaterialCatalog();
            const result = yield* readProgramRoute(
              "en",
              "curriculum/technical-program-1"
            ).pipe(Effect.provide(programLayer));
            expect(result).toMatchObject({
              activeReleaseId: MATERIAL_IDENTITY.releaseId,
              managed: false,
              routeJson: null,
            });
          })
        );
      }
    )
  );
  it.effect(
    "rejects a curriculum row whose indexed identity drifted",
    Effect.fn("contentRelease.program.route.test.rejectsDriftedIdentity")(
      function* () {
        const data = yield* makeProgramSnapshotData();
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            yield* activateProgramSnapshot(data);
            yield* tamperCurriculumRoute(data.snapshotId);
            const failure = yield* readProgramRoute(
              "en",
              "curriculum/technical-program-1"
            ).pipe(Effect.provide(programLayer), Effect.flip);
            expect(failure).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          })
        );
      }
    )
  );
  it.effect(
    "omits material projections removed after the program snapshot",
    Effect.fn("contentRelease.program.route.test.omitsRemovedMaterials")(
      function* () {
        const data = yield* makeProgramSnapshotData();
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            yield* activateProgramSnapshot(data);
            yield* insertCurriculumRoutes(data.snapshotId, [
              materialContext(1),
            ]);
            const result = yield* readProgramRoute("en", PROGRAM_ROOT).pipe(
              Effect.provide(programLayer)
            );
            expect(result).toMatchObject({
              managed: true,
              materialJson: [],
            });
          })
        );
      }
    )
  );
  it.effect(
    "rejects aggregate material fan-out beyond one route budget",
    Effect.fn("contentRelease.program.route.test.rejectsMaterialFanOut")(
      function* () {
        const data = yield* makeProgramSnapshotData();
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            yield* activateProgramSnapshot(data);
            yield* insertCurriculumRoutes(data.snapshotId, [
              materialContext(1),
              materialContext(2),
              materialContext(3),
            ]);
            yield* insertMaterialGroups([
              {
                materialIndex: 1,
                rowCount: 79,
              },
              {
                materialIndex: 2,
                rowCount: 78,
              },
              {
                materialIndex: 3,
                rowCount: 100,
              },
            ]);
            const failure = yield* readProgramRoute("en", PROGRAM_ROOT).pipe(
              Effect.provide(programLayer),
              Effect.flip
            );
            expect(failure).toMatchObject({
              code: "CONTENT_RELEASE_LIMIT",
            });
          })
        );
      }
    )
  );
  it.effect(
    "orders material groups by their authored route order",
    Effect.fn("contentRelease.program.route.test.ordersAuthoredGroups")(
      function* () {
        const data = yield* makeProgramSnapshotData();
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const earlierGroup = materialGroup(1, 10);
            const laterGroup = materialGroup(2, 20);
            const tiedGroup = materialGroup(3, 20);
            yield* activateProgramSnapshot(data);
            yield* insertCurriculumRoutes(data.snapshotId, [
              earlierGroup,
              laterGroup,
              tiedGroup,
              materialContext(1, laterGroup),
              materialContext(2, earlierGroup),
              materialContext(3, tiedGroup),
            ]);
            yield* insertMaterialGroups([
              {
                materialIndex: 1,
                rowCount: 1,
              },
              {
                materialIndex: 2,
                rowCount: 1,
              },
              {
                materialIndex: 3,
                rowCount: 1,
              },
            ]);
            const result = yield* readProgramRoute("en", PROGRAM_ROOT).pipe(
              Effect.provide(programLayer)
            );
            const groups = yield* Effect.forEach(
              result.groupJson,
              decodeSnapshotRowJson
            );
            expect(groups).toMatchObject([
              {
                family: "program",
                record: {
                  kind: "curriculum",
                  row: {
                    publicPath: earlierGroup.publicPath,
                  },
                },
              },
              {
                family: "program",
                record: {
                  kind: "curriculum",
                  row: {
                    publicPath: laterGroup.publicPath,
                  },
                },
              },
              {
                family: "program",
                record: {
                  kind: "curriculum",
                  row: {
                    publicPath: tiedGroup.publicPath,
                  },
                },
              },
            ]);
          })
        );
      }
    )
  );
});
