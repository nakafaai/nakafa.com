import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { CleanupRepair } from "@repo/backend/convex/tryouts/migration/cleanup/schema";

interface RepairRun {
  readonly questionCount: number;
  readonly sectionIdentity: string;
}

export interface ScaleRepairEvidence {
  readonly itemCount: number;
  readonly migrationId: string;
  readonly planHash: string;
  readonly publishedAt: number;
  readonly questionCount: number;
  readonly runs: readonly RepairRun[];
  readonly scaleVersionId: string;
  readonly setIdentity: string;
  readonly sourceSnapshotId: string;
}

const retainedCatalogParent = {
  appLocale: AppLocaleSchema.make("en"),
  countryKey: "indonesia",
  examKey: "snbt",
  setKey: "set-2",
  trackKey: "2027",
} as const;

/** Projects a retained section through Aksara's identity contract. */
function retainedSectionIdentity(sectionKey: string) {
  return tryoutCatalogNodeIdentity({
    ...retainedCatalogParent,
    kind: "section",
    sectionKey,
  });
}

/** Exact production graph omitted by the signed attempt-derived inventory. */
export const retainedScaleRepair = {
  itemCount: 150,
  migrationId: "retained-tryout-history",
  planHash:
    "sha256:9ac40883fe6c7856a4f69e492513229d4dc4596df12d78bfc7a7c9fe182c81f9",
  publishedAt: 1_783_529_292_775,
  questionCount: 150,
  runs: [
    {
      questionCount: 20,
      sectionIdentity: retainedSectionIdentity("reading-and-writing-skills"),
    },
    {
      questionCount: 20,
      sectionIdentity: retainedSectionIdentity("general-knowledge"),
    },
    {
      questionCount: 20,
      sectionIdentity: retainedSectionIdentity("english-language"),
    },
    {
      questionCount: 30,
      sectionIdentity: retainedSectionIdentity("indonesian-language"),
    },
    {
      questionCount: 20,
      sectionIdentity: retainedSectionIdentity("general-reasoning"),
    },
    {
      questionCount: 20,
      sectionIdentity: retainedSectionIdentity("mathematical-reasoning"),
    },
    {
      questionCount: 20,
      sectionIdentity: retainedSectionIdentity("quantitative-knowledge"),
    },
  ],
  scaleVersionId: "wh77kyh90xdyy9bxkve0h7w4d98a5ghm",
  setIdentity: tryoutCatalogNodeIdentity({
    ...retainedCatalogParent,
    kind: "set",
  }),
  sourceSnapshotId:
    "sha256:0a43a4125fc4886f90b5a509405178bfb8762ad3c7f72be80614fce2671b5162",
} satisfies ScaleRepairEvidence;

/** Counts the exact graph rows bound by one repair evidence record. */
export function countScaleRepairRows(evidence: ScaleRepairEvidence) {
  return evidence.itemCount + evidence.runs.length + 1;
}

/** Checks bounded cardinalities before they reach indexed query limits. */
export function hasValidScaleRepairEvidence(evidence: ScaleRepairEvidence) {
  const questionCount = evidence.runs.reduce(
    (count, run) => count + run.questionCount,
    0
  );
  return (
    Number.isSafeInteger(evidence.itemCount) &&
    evidence.itemCount > 0 &&
    evidence.itemCount === evidence.questionCount &&
    Number.isSafeInteger(evidence.publishedAt) &&
    evidence.publishedAt > 0 &&
    Number.isSafeInteger(evidence.questionCount) &&
    evidence.questionCount > 0 &&
    evidence.runs.length > 0 &&
    new Set(evidence.runs.map(({ sectionIdentity }) => sectionIdentity))
      .size === evidence.runs.length &&
    evidence.runs.every(
      ({ questionCount: count, sectionIdentity }) =>
        Number.isSafeInteger(count) && count > 0 && sectionIdentity.length > 0
    ) &&
    Number.isSafeInteger(questionCount) &&
    questionCount === evidence.questionCount
  );
}

/** Verifies the persisted repair still binds the exact source evidence. */
export function matchesScaleRepair(
  repair: CleanupRepair,
  evidence: ScaleRepairEvidence,
  deletedRows: number
) {
  return (
    repair.deletedRows === deletedRows &&
    repair.itemCount === evidence.itemCount &&
    repair.migrationId === evidence.migrationId &&
    repair.planHash === evidence.planHash &&
    repair.publishedAt === evidence.publishedAt &&
    repair.questionCount === evidence.questionCount &&
    Number.isSafeInteger(repair.repairedAt) &&
    repair.repairedAt > 0 &&
    repair.runCount === evidence.runs.length &&
    repair.runs.length === evidence.runs.length &&
    repair.runs.every(
      (run, index) =>
        run.questionCount === evidence.runs[index]?.questionCount &&
        run.sectionIdentity === evidence.runs[index]?.sectionIdentity
    ) &&
    repair.scaleVersionId === evidence.scaleVersionId &&
    repair.setIdentity === evidence.setIdentity &&
    repair.sourceSnapshotId === evidence.sourceSnapshotId
  );
}

/** Requires the exact durable audit for the one migration that owns a repair. */
export function hasRequiredScaleRepair(
  migrationId: string,
  repair: CleanupRepair | null | undefined,
  evidence: ScaleRepairEvidence = retainedScaleRepair
) {
  return (
    migrationId !== evidence.migrationId ||
    (repair !== null &&
      repair !== undefined &&
      matchesScaleRepair(repair, evidence, countScaleRepairRows(evidence)))
  );
}
