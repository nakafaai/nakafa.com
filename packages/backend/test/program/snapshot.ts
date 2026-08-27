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
  CurriculumRouteSchema,
} from "@nakafa/aksara-contracts/program/curriculum";
import { digestProgramRows } from "@nakafa/aksara-contracts/program/snapshot/digest";
import { makeProgramSnapshot } from "@nakafa/aksara-contracts/program/snapshot/hash";
import {
  makeCurriculumSnapshotRow,
  makeProgramSnapshotRow,
} from "@nakafa/aksara-contracts/program/snapshot/row-hash";
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
import { encodeSnapshotJson } from "@repo/backend/convex/contentRelease/wire";
import type schema from "@repo/backend/convex/schema";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import {
  TEST_STAGE_SNAPSHOT,
  TEST_STAGE_SNAPSHOT_BATCH,
} from "@repo/backend/test/snapshot/routes";
import type { TestConvex } from "convex-test";
import { Effect, Stream } from "effect";
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
  const translation = program.translations.find(
    (candidate) => candidate.appLocale === appLocale
  );
  if (!translation) {
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
      `${CURRICULUM_NAMESPACES[appLocaleCode]}/${translation.publicSlug}`
    ),
    sitemap: true,
    sourcePath: CorpusSourcePathSchema.make(
      `packages/corpus/curriculum/${program.key}`
    ),
    title: translation.title,
  });
}
/** Orders curriculum roots by the signed stream's code-unit identity. */
function compareCurriculum(
  left: ReturnType<typeof technicalCurriculum>,
  right: ReturnType<typeof technicalCurriculum>
) {
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
  activeAppLocales: ActiveAppLocaleList = ACTIVE_APP_LOCALES
) {
  const catalog = yield* Effect.forEach(programs, makeProgramSnapshotRow);
  const curriculumRoutes = programs
    .filter((program) => program.navigation.model === "curriculum-tree")
    .flatMap((program) =>
      activeAppLocales.map((appLocale) =>
        technicalCurriculum(program, appLocale)
      )
    )
    .sort(compareCurriculum);
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
  const catalogRows = catalog.map(
    (record) =>
      ({
        family: "program",
        record,
      }) satisfies ContentSnapshotRow
  );
  const curriculumRows = curriculum.map(
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
    rowJson: rows.map(canonicalizeContentSnapshotRow),
    rows,
    snapshot,
    snapshotId,
    snapshots,
  };
});
export type ProgramSnapshotData = Effect.Success<
  ReturnType<typeof makeProgramSnapshotData>
>;
/** Stages one complete technical program snapshot through public internals. */
export async function stageProgramSnapshot(
  t: TestConvex<typeof schema>,
  data: ProgramSnapshotData,
  batchSize = data.rowJson.length
) {
  await t.mutation((ctx) =>
    insertTestRelease(ctx, {
      activeAppLocales: data.snapshot.manifest.activeAppLocales,
      snapshots: data.snapshots,
    })
  );
  await t.mutation(TEST_STAGE_SNAPSHOT, {
    releaseId: TEST_RELEASE_ID,
    snapshotJson: data.manifestJson,
  });
  for (
    let firstIndex = 0, batchIndex = 0;
    firstIndex < data.rowJson.length;
    firstIndex += batchSize, batchIndex += 1
  ) {
    await t.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
      batchIndex,
      family: "program",
      releaseId: TEST_RELEASE_ID,
      rowJson: data.rowJson.slice(firstIndex, firstIndex + batchSize),
      snapshotId: data.snapshotId,
    });
  }
}
/** Selects one verified program snapshot with a coherent material owner. */
export async function activateProgramSnapshot(
  t: TestConvex<typeof schema>,
  data: ProgramSnapshotData,
  batchSize = data.rowJson.length
) {
  await stageProgramSnapshot(t, data, batchSize);
  await t.mutation(async (ctx) => {
    const [release, snapshot, state] = await Promise.all([
      ctx.db.query("contentReleases").unique(),
      ctx.db.query("contentSnapshots").unique(),
      ctx.db.query("contentState").unique(),
    ]);
    if (!(release && snapshot && state)) {
      throw new Error("Expected one staged program snapshot.");
    }
    await ctx.db.patch("contentReleases", release._id, {
      completedAt: 1,
      status: "completed",
    });
    await ctx.db.patch("contentSnapshots", snapshot._id, { verifiedAt: 1 });
    await ctx.db.patch("contentState", state._id, {
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
}
