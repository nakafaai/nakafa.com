import {
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALES,
  type ActiveAppLocale,
  type ActiveAppLocaleList,
  ActiveAppLocaleSchema,
  activeAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import {
  CURRICULUM_NAMESPACES,
  type CurriculumRoute,
  CurriculumRouteSchema,
} from "@nakafa/aksara-contracts/program/curriculum";
import { digestProgramRows } from "@nakafa/aksara-contracts/program/snapshot/digest";
import {
  makeCurriculumSnapshotRow,
  makeProgramSnapshot,
  makeProgramSnapshotRow,
} from "@nakafa/aksara-contracts/program/snapshot/hash";
import {
  type LearningProgram,
  LearningProgramKeySchema,
  LearningProgramSchema,
} from "@nakafa/aksara-contracts/program/spec";
import {
  type ContentSnapshotManifest,
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
  MutationRunner,
} from "@repo/backend/confect/_generated/services";
import { encodeSnapshotJson } from "@repo/backend/confect/contentRelease/wire";
import type {
  MutationCtx as ConvexMutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import { Array as Arr, Effect, Option, Order, pipe, Stream } from "effect";
/** Builds one explicit technical program row for backend protocol tests. */
export function makeTechnicalProgram(
  index: number,
  kind: LearningProgram["kind"] = "school-curriculum"
) {
  return LearningProgramSchema.make({
    defaultCoverageStatus: "planned",
    displayOrder: index * 10,
    iconKey: "school",
    key: LearningProgramKeySchema.make(`technical-program-${index}`),
    kind,
    navigation: {
      levels: ["track", "topic"],
      model: "curriculum-tree",
    },
    provider: { kind: "nakafa", name: "Nakafa protocol tests" },
    sources: [
      {
        label: `Technical protocol source ${index}`,
        retrievedAt: "2026-07-24",
        type: "nakafa-editorial",
        url: `https://example.test/program-${index}`,
      },
    ],
    translations: [
      {
        appLocale: ActiveAppLocaleSchema.make("en"),
        publicSlug: `technical-program-${index}`,
        title: `Technical Program ${index}`,
      },
      {
        appLocale: ActiveAppLocaleSchema.make("id"),
        publicSlug: `program-teknis-${index}`,
        title: `Program Teknis ${index}`,
      },
      {
        appLocale: ActiveAppLocaleSchema.make("de"),
        publicSlug: `technisches-programm-${index}`,
        title: `Technisches Programm ${index}`,
      },
    ],
    version: { label: "Technical protocol version" },
  });
}
/** Builds one locale-specific root for a technical program contract row. */
function technicalCurriculum(
  program: ReturnType<typeof makeTechnicalProgram>,
  appLocale: ActiveAppLocale
) {
  const appLocaleCode = activeAppLocaleCode(appLocale);
  const translation = Arr.findFirst(
    program.translations,
    (candidate) => candidate.appLocale === appLocale
  );
  if (Option.isNone(translation)) {
    throw new Error(
      `Technical program ${program.key} is missing ${appLocale} copy.`
    );
  }
  return CurriculumRouteSchema.make({
    appLocale,
    iconKey: program.iconKey,
    kind: "curriculum-context",
    level: "track",
    nodeKey: `${program.key}:root`,
    order: program.displayOrder,
    programKey: program.key,
    publicPath: PublicPathSchema.make(
      `${CURRICULUM_NAMESPACES[appLocaleCode]}/${translation.value.publicSlug}`
    ),
    sitemap: true,
    sourcePath: CorpusSourcePathSchema.make(
      `packages/corpus/curriculum/${program.key}`
    ),
    title: translation.value.title,
  });
}
/** Orders curriculum roots by the signed stream's code-unit identity. */
function compareCurriculum(
  left: ReturnType<typeof technicalCurriculum>,
  right: ReturnType<typeof technicalCurriculum>
): -1 | 0 | 1 {
  const leftKey = `${left.programKey}\0${left.appLocale}\0${left.publicPath}`;
  const rightKey = `${right.programKey}\0${right.appLocale}\0${right.publicPath}`;
  if (leftKey < rightKey) {
    return -1;
  }
  return leftKey === rightKey ? 0 : 1;
}
/** Prepares one complete eight-row program snapshot and its signed transition. */
export const makeProgramSnapshotData = Effect.fn(
  "backendTest.makeProgramSnapshotData"
)(function* (
  programs: readonly LearningProgram[] = [
    makeTechnicalProgram(1),
    makeTechnicalProgram(2),
  ],
  activeAppLocales: ActiveAppLocaleList = ACTIVE_APP_LOCALES,
  additionalRoutes: readonly CurriculumRoute[] = []
) {
  const catalog = yield* Effect.forEach(programs, makeProgramSnapshotRow);
  const curriculumRoutes = pipe(
    programs,
    Arr.filter((program) => program.navigation.model === "curriculum-tree"),
    Arr.flatMap((program) =>
      Arr.map(activeAppLocales, (appLocale) =>
        technicalCurriculum(program, appLocale)
      )
    ),
    Arr.appendAll(additionalRoutes),
    Arr.sort(Order.make(compareCurriculum))
  );
  const curriculum = yield* Effect.forEach(
    curriculumRoutes,
    makeCurriculumSnapshotRow
  );
  const records = [...catalog, ...curriculum];
  const evidence = yield* digestProgramRows({
    activeAppLocales,
    rows: Stream.fromIterable(records),
  });
  const manifest = yield* makeProgramSnapshot({
    activeAppLocales,
    ...evidence,
  });
  const snapshotId = manifest.snapshotId;
  const snapshot: ContentSnapshotManifest = {
    family: "program",
    manifest,
  };
  const catalogRows = Arr.map(
    catalog,
    (record) =>
      ({
        family: "program",
        record,
      }) satisfies ContentSnapshotRow
  );
  const curriculumRows = Arr.map(
    curriculum,
    (record) =>
      ({
        family: "program",
        record,
      }) satisfies ContentSnapshotRow
  );
  const rows = [...catalogRows, ...curriculumRows];
  const snapshots = {
    ...inheritContentSnapshots(null),
    program: replaceContentSnapshot({
      baseSnapshotId: null,
      resultSnapshotId: snapshotId,
      rowCount: evidence.rowCount,
      rowDigest: evidence.rowDigest,
    }),
  };
  return {
    manifestJson: encodeSnapshotJson(snapshot),
    rowJson: Arr.map(rows, canonicalizeContentSnapshotRow),
    rows,
    snapshot,
    snapshotId,
    snapshots,
  };
});
export type ProgramSnapshotData = Effect.Success<
  ReturnType<typeof makeProgramSnapshotData>
>;
/** Stages the signed technical program snapshot through registered Confect mutations. */
export const stageProgramSnapshot = Effect.fn("TestProgram.stageSnapshot")(
  function* (data: ProgramSnapshotData, batchSize = data.rowJson.length) {
    const ctx = yield* MutationCtx;
    const { runMutation: mutate } = yield* MutationRunner;
    yield* Effect.promise(() =>
      insertTestRelease(ctx, {
        activeAppLocales: data.snapshot.manifest.activeAppLocales,
        snapshots: data.snapshots,
      })
    );
    yield* mutate(
      refs.internal.contentRelease.snapshot.manifest.stageSnapshot,
      {
        releaseId: TEST_RELEASE_ID,
        snapshotJson: data.manifestJson,
      }
    );
    for (
      let firstIndex = 0, batchIndex = 0;
      firstIndex < data.rowJson.length;
      firstIndex += batchSize, batchIndex += 1
    ) {
      yield* mutate(
        refs.internal.contentRelease.snapshot.batch.stageSnapshotBatch,
        {
          batchIndex,
          family: "program",
          releaseId: TEST_RELEASE_ID,
          rowJson: Arr.take(Arr.drop(data.rowJson, firstIndex), batchSize),
          snapshotId: data.snapshotId,
        }
      );
    }
  }
);

/** Selects one verified program snapshot with a coherent material owner. */
export const activateProgramSnapshot = Effect.fn(
  "TestProgram.activateSnapshot"
)(function* (data: ProgramSnapshotData, batchSize = data.rowJson.length) {
  yield* stageProgramSnapshot(data, batchSize);
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const release = yield* reader
    .table("contentReleases")
    .get("by_releaseId", TEST_RELEASE_ID);
  const snapshot = yield* reader
    .table("contentSnapshots")
    .get("by_family_and_snapshotId", "program", data.snapshotId);
  const state = yield* reader.table("contentState").get("by_key", "primary");
  yield* writer
    .table("contentReleases")
    .patch(release._id, { completedAt: 1, status: "completed" });
  yield* writer
    .table("contentSnapshots")
    .patch(snapshot._id, { verifiedAt: 1 });
  yield* writer.table("contentState").patch(state._id, {
    activeManifestHash: TEST_MANIFEST_HASH,
    activeReleaseId: TEST_RELEASE_ID,
    activeSequence: 1,
    candidateManifestHash: undefined,
    candidateReleaseId: undefined,
    candidateSequence: undefined,
    materialManifestHash: TEST_MANIFEST_HASH,
    materialReleaseId: TEST_RELEASE_ID,
    materialSequence: 1,
  });
});

/** Inserts one expired manifest and a requested number of physical rows. */
export async function insertExpiredProgram(
  ctx: ConvexMutationCtx,
  snapshotId: string,
  rowCount: number,
  cleanupAt?: number
) {
  await ctx.db.insert("contentSnapshots", {
    ...(cleanupAt === undefined
      ? {}
      : {
          cleanupAt,
        }),
    createdAt: 0,
    family: "program",
    retainUntil: 0,
    snapshotId,
    snapshotJson: "{}",
  });
  for (let index = 0; index < rowCount; index += 1) {
    await ctx.db.insert("programCatalog", {
      displayOrder: index,
      index,
      programKey: `program-${index}`,
      rowHash: `sha256:${index.toString(16).padStart(64, "0")}`,
      rowJson: "{}",
      snapshotId,
    });
  }
}

/** Captures staged program rows and counters to prove failed batches are atomic. */
export async function readProgramStage(ctx: QueryCtx) {
  return {
    release: await ctx.db.query("contentReleases").unique(),
    batches: await ctx.db.query("snapshotBatches").collect(),
    programs: await ctx.db.query("programCatalog").collect(),
    routes: await ctx.db.query("curriculumRoutes").collect(),
  };
}
