import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import {
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import { ActiveAppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  CurriculumNodeKeySchema,
  type CurriculumRoute,
  CurriculumRouteSchema,
} from "@nakafa/aksara-contracts/program/curriculum";
import { makeCurriculumSnapshotRow } from "@nakafa/aksara-contracts/program/snapshot/hash";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import {
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { stageProgramRow } from "@repo/backend/confect/contentRelease/snapshot/program";
import type { LearningContextInput } from "@repo/backend/confect/contents/context";
import type schema from "@repo/backend/convex/schema";
import { FUNCTION_MATERIAL } from "@repo/backend/test/content/material";
import { insertMaterialProjection } from "@repo/backend/test/material/catalog";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import type { TestConvex } from "convex-test";
import { Effect } from "effect";

export const PROGRAM_KEY = LearningProgramKeySchema.make("technical-program-1");
export const GROUP_KEY = CurriculumNodeKeySchema.make("test-group");
const ROOT_PATH = PublicPathSchema.make("curriculum/technical-program-1");
export const SUBJECT_PATH = PublicPathSchema.make(
  "curriculum/technical-program-1/test-subject"
);
export const GROUP_PATH = PublicPathSchema.make(
  "curriculum/technical-program-1/test-subject/test-group"
);
const SOURCE_PATH = CorpusSourcePathSchema.make(
  "packages/corpus/curriculum/technical-program-1"
);
/** The public hint that reaches the fixture lesson through its placement. */
export const PLACEMENT = {
  mode: "placement",
  nodeKey: GROUP_KEY,
  programKey: PROGRAM_KEY,
} satisfies LearningContextInput;

/** Creates the card-list parent for the placement group. */
function subjectRoute(): CurriculumRoute {
  return CurriculumRouteSchema.make({
    iconKey: "science",
    kind: "curriculum-context",
    level: "subject",
    appLocale: ActiveAppLocaleSchema.make("en"),
    nodeKey: "test-subject",
    order: 1,
    parentPath: ROOT_PATH,
    programKey: PROGRAM_KEY,
    publicPath: SUBJECT_PATH,
    sitemap: true,
    sourcePath: SOURCE_PATH,
    title: "Technical Subject",
  });
}

/** Creates the placement group named by the public context hint. */
function groupRoute(): CurriculumRoute {
  return CurriculumRouteSchema.make({
    iconKey: "science",
    kind: "curriculum-context",
    level: "topic",
    appLocale: ActiveAppLocaleSchema.make("en"),
    materialCardDescription: "Technical card description.",
    materialCardTitle: "Technical Group",
    nodeKey: GROUP_KEY,
    order: 1,
    parentPath: SUBJECT_PATH,
    programKey: PROGRAM_KEY,
    publicPath: GROUP_PATH,
    sitemap: false,
    sourcePath: SOURCE_PATH,
    title: "Technical Group",
  });
}

/** Creates one immutable material mapping for the placement group. */
function mappingRoute(
  canonicalPath: typeof FUNCTION_MATERIAL.publicPath
): CurriculumRoute {
  return CurriculumRouteSchema.make({
    canonicalPath,
    iconKey: "science",
    kind: "curriculum-context",
    level: "lesson",
    appLocale: ActiveAppLocaleSchema.make("en"),
    materialContextNodeKey: GROUP_KEY,
    materialContextParentPath: SUBJECT_PATH,
    materialContextPublicPath: GROUP_PATH,
    materialKey: FUNCTION_MATERIAL.materialKey,
    nodeKey: "test-material-mapping",
    order: 1,
    parentPath: GROUP_PATH,
    programKey: PROGRAM_KEY,
    publicPath: PublicPathSchema.make(`${GROUP_PATH}/test-material-mapping`),
    sitemap: false,
    sourcePath: SOURCE_PATH,
    title: "Technical Material Mapping",
  });
}

/** Adds current signed placement rows to the active program snapshot. */
const stagePlacement = Effect.fn("contents.views.test.stagePlacement")(
  function* (
    target: TestConvex<typeof schema>,
    snapshotId: string,
    canonicalPath: typeof FUNCTION_MATERIAL.publicPath
  ) {
    const runtimeServices = yield* Effect.context<never>();
    const routes = [subjectRoute(), groupRoute(), mappingRoute(canonicalPath)];
    const rows = yield* Effect.forEach(routes, (route) =>
      Effect.gen(function* () {
        const record = yield* makeCurriculumSnapshotRow(route);
        const source = {
          family: "program",
          record,
        } satisfies ContentSnapshotRow;
        return {
          rowJson: canonicalizeContentSnapshotRow(source),
          source,
        };
      })
    );
    yield* Effect.forEach(
      rows,
      (row, offset) =>
        Effect.promise(() =>
          target.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              stageProgramRow(
                snapshotId,
                offset + 100,
                row.source.record,
                row.rowJson
              ).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
            )
          )
        ),
      { discard: true }
    );
  }
);

/** Activates one current signed program and material placement fixture. */
export const activatePlacement = Effect.fn(
  "contents.views.test.activatePlacement"
)(function* (
  target: TestConvex<typeof schema>,
  canonicalPath: typeof FUNCTION_MATERIAL.publicPath,
  projection: MaterialLessonProjection = FUNCTION_MATERIAL
) {
  const runtimeServices = yield* Effect.context<never>();
  const data = yield* makeProgramSnapshotData();
  yield* Effect.promise(() =>
    target.mutation((ctx) =>
      Effect.runPromiseWith(runtimeServices)(
        activateProgramSnapshot(data).pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      )
    )
  );
  yield* stagePlacement(target, data.snapshotId, canonicalPath);
  yield* Effect.promise(() =>
    target.mutation((ctx) =>
      Effect.runPromiseWith(runtimeServices)(
        insertMaterialProjection(projection).pipe(
          Effect.provide(mutationLayer(confectSchema, ctx))
        )
      )
    )
  );
});
