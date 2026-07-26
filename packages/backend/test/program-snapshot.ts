import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import {
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  CURRICULUM_NAMESPACES,
  CurriculumRouteSchema,
} from "@nakafa/aksara-contracts/program/curriculum";
import { digestProgramRows } from "@nakafa/aksara-contracts/program/row-digest";
import {
  makeCurriculumSnapshotRow,
  makeProgramSnapshotRow,
} from "@nakafa/aksara-contracts/program/row-hash";
import {
  PROGRAM_SNAPSHOT_FORMAT,
  type ProgramSnapshotInput,
  ProgramSnapshotSchema,
} from "@nakafa/aksara-contracts/program/snapshot";
import { hashProgramSnapshot } from "@nakafa/aksara-contracts/program/snapshot-hash";
import {
  LearningProgramKeySchema,
  LearningProgramSchema,
} from "@nakafa/aksara-contracts/program/spec";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot";
import {
  type ContentSnapshotManifest,
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import { encodeSnapshotJson } from "@repo/backend/convex/contentRelease/wire";
import type schema from "@repo/backend/convex/schema";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import {
  TEST_STAGE_SNAPSHOT,
  TEST_STAGE_SNAPSHOT_BATCH,
} from "@repo/backend/test/snapshot-routes";
import type { TestConvex } from "convex-test";
import { Effect, Stream } from "effect";

/** Builds one explicit technical program row for backend protocol tests. */
function technicalProgram(index: number) {
  return LearningProgramSchema.make({
    defaultCoverageStatus: "planned",
    displayOrder: index * 10,
    iconKey: "school",
    key: LearningProgramKeySchema.make(`technical-program-${index}`),
    kind: "school-curriculum",
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
    translations: {
      en: {
        publicSlug: `technical-program-${index}`,
        title: `Technical Program ${index}`,
      },
      id: {
        publicSlug: `program-teknis-${index}`,
        title: `Program Teknis ${index}`,
      },
    },
    version: { label: "Technical protocol version" },
  });
}

/** Builds one locale-specific root for a technical program contract row. */
function technicalCurriculum(
  program: ReturnType<typeof technicalProgram>,
  locale: "en" | "id"
) {
  const translation = program.translations[locale];
  return CurriculumRouteSchema.make({
    iconKey: program.iconKey,
    kind: "curriculum-context",
    level: "track",
    locale,
    nodeKey: `${program.key}:root`,
    order: program.displayOrder,
    programKey: program.key,
    publicPath: PublicPathSchema.make(
      `${CURRICULUM_NAMESPACES[locale]}/${translation.publicSlug}`
    ),
    sitemap: true,
    sourcePath: CorpusSourcePathSchema.make(
      `packages/corpus/curriculum/${program.key}`
    ),
    title: translation.title,
  });
}

/** Prepares one complete six-row program snapshot and its signed transition. */
export const makeProgramSnapshotData = Effect.fn(
  "backendTest.makeProgramSnapshotData"
)(function* () {
  const programs = [technicalProgram(1), technicalProgram(2)];
  const catalog = yield* Effect.forEach(programs, makeProgramSnapshotRow);
  const curriculum = yield* Effect.forEach(
    programs.flatMap((program) =>
      ContentLocaleSchema.literals.map((locale) =>
        technicalCurriculum(program, locale)
      )
    ),
    makeCurriculumSnapshotRow
  );
  const records = [...catalog, ...curriculum];
  const evidence = yield* digestProgramRows(Stream.fromIterable(records));
  const input: ProgramSnapshotInput = {
    ...evidence,
    format: PROGRAM_SNAPSHOT_FORMAT,
    locales: ["en", "id"],
  };
  const snapshotId = yield* hashProgramSnapshot(input);
  const snapshot: ContentSnapshotManifest = {
    family: "program",
    manifest: ProgramSnapshotSchema.make({ ...input, snapshotId }),
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
      rowCount: input.rowCount,
      rowDigest: input.rowDigest,
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

export type ProgramSnapshotData = Effect.Effect.Success<
  ReturnType<typeof makeProgramSnapshotData>
>;

/** Stages one complete technical program snapshot through public internals. */
export async function stageProgramSnapshot(
  t: TestConvex<typeof schema>,
  data: ProgramSnapshotData,
  batchSize = data.rowJson.length
) {
  await t.mutation((ctx) =>
    insertTestRelease(ctx, { snapshots: data.snapshots })
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
  data: ProgramSnapshotData
) {
  await stageProgramSnapshot(t, data);
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
