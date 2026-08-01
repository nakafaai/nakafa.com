import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type {
  TryoutCatalogRecord,
  TryoutCatalogRow,
  TryoutPlacementRecord,
} from "@nakafa/aksara-contracts/tryout/spec";

/** Derives the canonical set identity shared by set and section rows. */
export function tryoutCatalogSetIdentity(row: TryoutCatalogRow) {
  if (row.kind !== "set" && row.kind !== "section") {
    return;
  }

  return tryoutCatalogIdentity({
    countryKey: row.countryKey,
    examKey: row.examKey,
    kind: "set",
    locale: row.locale,
    setKey: row.setKey,
    trackKey: row.trackKey,
  });
}

/** Derives the exact indexed facts stored beside one signed catalog row. */
export function tryoutCatalogFacts(record: TryoutCatalogRecord) {
  const { row } = record;
  return {
    identity: tryoutCatalogIdentity(row),
    kind: row.kind,
    locale: row.locale,
    order: row.kind === "country" || row.kind === "exam" ? 0 : row.order,
    publicPath: row.publicPath,
    setIdentity: tryoutCatalogSetIdentity(row),
  };
}

/** Derives the exact server-only facts stored beside one signed placement. */
export function tryoutPlacementFacts(record: TryoutPlacementRecord) {
  const { row } = record;
  return {
    answerArtifactHash: row.answerArtifactHash,
    contentHash: row.contentHash,
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
