import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  digestProgramRows,
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
  emptyContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot";
import {
  type ContentSnapshotManifest,
  type ContentSnapshotRow,
  canonicalizeContentSnapshotManifest,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import type schema from "@repo/backend/convex/schema";
import {
  TEST_DIGEST,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import { makeFunctionReference } from "convex/server";
import type { TestConvex } from "convex-test";
import { Effect, Stream } from "effect";

interface SnapshotArgs extends Record<string, string> {
  readonly releaseId: string;
  readonly snapshotJson: string;
}

interface SnapshotReceipt {
  readonly created: number;
  readonly family: "program" | "quran" | "tryout";
  readonly releaseId: string;
  readonly snapshotId: string;
  readonly unchanged: number;
}

interface SnapshotBatchArgs
  extends Record<string, number | readonly string[] | string> {
  readonly batchIndex: number;
  readonly family: "program" | "quran" | "tryout";
  readonly releaseId: string;
  readonly rowJson: readonly string[];
  readonly snapshotId: string;
}

interface SnapshotBatchReceipt {
  readonly batchIndex: number;
  readonly created: number;
  readonly family: "program" | "quran" | "tryout";
  readonly releaseId: string;
  readonly snapshotId: string;
  readonly unchanged: number;
}

export const TEST_STAGE_SNAPSHOT = makeFunctionReference<
  "mutation",
  SnapshotArgs,
  SnapshotReceipt
>("contentRelease/snapshot/manifest:stageSnapshot");

export const TEST_STAGE_SNAPSHOT_BATCH = makeFunctionReference<
  "mutation",
  SnapshotBatchArgs,
  SnapshotBatchReceipt
>("contentRelease/snapshot/batch:stageSnapshotBatch");

/** Builds one schema-valid blocked Quran manifest without authored text. */
export function makeBlockedQuranSnapshot(): Extract<
  ContentSnapshotManifest,
  { readonly family: "quran" }
> {
  return {
    family: "quran",
    manifest: {
      chunkCount: 1085,
      format: "quran-snapshot-v1",
      locales: ["en", "id"],
      projectionCount: 1427,
      projectionDigest: TEST_DIGEST,
      provenanceDigest: TEST_DIGEST,
      provenanceStatus: "blocked",
      runtimeCount: 1199,
      runtimeDigest: TEST_DIGEST,
      searchCount: 228,
      searchDigest: TEST_DIGEST,
      snapshotId: Sha256HashSchema.make(`sha256:${"4".repeat(64)}`),
      sourceBytes: 1,
      sourceDigest: TEST_DIGEST,
      surahCount: 114,
      tafsirLocales: ["id"],
      verseCount: 6236,
    },
  };
}

/** Builds one explicit technical program row for backend protocol tests. */
function technicalProgram(index: number) {
  return LearningProgramSchema.make({
    defaultCoverageStatus: "planned",
    displayOrder: index * 10,
    iconKey: "school",
    key: LearningProgramKeySchema.make(`technical-program-${index}`),
    kind: "school-curriculum",
    navigation: {
      levels: ["stage", "subject"],
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

/** Prepares one complete six-row program snapshot and its signed transition. */
export const makeProgramSnapshotData = Effect.fn(
  "backendTest.makeProgramSnapshotData"
)(function* () {
  const records = yield* Effect.forEach([1, 2, 3, 4, 5, 6], (index) =>
    makeProgramSnapshotRow(technicalProgram(index))
  );
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
  const rows: readonly ContentSnapshotRow[] = records.map((record) => ({
    family: "program",
    record,
  }));
  const snapshots = {
    ...emptyContentSnapshots(),
    program: replaceContentSnapshot({
      baseSnapshotId: null,
      resultSnapshotId: snapshotId,
      rowCount: input.rowCount,
      rowDigest: input.rowDigest,
    }),
  };
  return {
    manifestJson: canonicalizeContentSnapshotManifest(snapshot),
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
