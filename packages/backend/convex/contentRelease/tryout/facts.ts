import type {
  TryoutCatalogRecord,
  TryoutCatalogRow,
} from "@nakafa/aksara-contracts/tryout/catalog";
import {
  tryoutCatalogIdentity,
  tryoutCatalogNodeIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { TryoutPlacementRecord } from "@nakafa/aksara-contracts/tryout/placement";

/** Derives the canonical set identity shared by set and section rows. */
function catalogSetIdentity(row: TryoutCatalogRow) {
  if (row.kind !== "set" && row.kind !== "section") {
    return;
  }

  return tryoutCatalogNodeIdentity({
    appLocale: row.appLocale,
    countryKey: row.countryKey,
    examKey: row.examKey,
    kind: "set",
    setKey: row.setKey,
    trackKey: row.trackKey,
  });
}

/** Derives the exact indexed facts stored beside one signed catalog row. */
export function tryoutCatalogFacts(record: TryoutCatalogRecord) {
  const { row } = record;
  return {
    assetId: row.graph.assetId,
    identity: tryoutCatalogIdentity(row),
    kind: row.kind,
    appLocale: row.appLocale,
    order: row.kind === "country" || row.kind === "exam" ? 0 : row.order,
    publicPath: row.publicPath,
    setIdentity: catalogSetIdentity(row),
  };
}

/** Derives the exact server-only facts stored beside one signed placement. */
export function tryoutPlacementFacts(record: TryoutPlacementRecord) {
  const { row } = record;
  return {
    answerArtifactHash: row.answerArtifactHash,
    answerArtifactLocale: row.answerArtifactLocale,
    appLocale: row.appLocale,
    contentHash: row.contentHash,
    countryKey: row.countryKey,
    deliveryLanguage: row.deliveryLanguage,
    examKey: row.examKey,
    identity: tryoutPlacementIdentity(row),
    questionArtifactHash: row.questionArtifactHash,
    questionArtifactLocale: row.questionArtifactLocale,
    questionOrder: row.questionOrder,
    sectionKey: row.sectionKey,
    setKey: row.setKey,
    trackKey: row.trackKey,
  };
}
