import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type {
  TryoutCatalogRecord,
  TryoutPlacementRecord,
} from "@nakafa/aksara-contracts/tryout/spec";

/** Derives the exact indexed facts stored beside one signed catalog row. */
export function tryoutCatalogFacts(record: TryoutCatalogRecord) {
  const { row } = record;
  return {
    identity: tryoutCatalogIdentity(row),
    kind: row.kind,
    locale: row.locale,
    order: row.kind === "country" || row.kind === "exam" ? 0 : row.order,
    publicPath: row.publicPath,
  };
}

/** Derives the exact server-only facts stored beside one signed placement. */
export function tryoutPlacementFacts(record: TryoutPlacementRecord) {
  const { row } = record;
  return {
    answerArtifactHash: row.answerArtifactHash,
    countryKey: row.countryKey,
    examKey: row.examKey,
    identity: tryoutPlacementIdentity(row),
    locale: row.locale,
    questionArtifactHash: row.questionArtifactHash,
    questionOrder: row.questionOrder,
    sectionKey: row.sectionKey,
    setKey: row.setKey,
    trackKey: row.trackKey,
  };
}
