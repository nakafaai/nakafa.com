import type { CatalogSetSchema } from "@nakafa/aksara-contracts/assessment/catalog";
import {
  type AssessmentRow,
  assessmentRowIdentity,
} from "@nakafa/aksara-contracts/assessment/snapshot";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Array as Arr } from "effect";

/** The indexed facts of one stored row, every field but its place and its text. */
type AssessmentRowFacts = Omit<
  Docs["assessmentRows"],
  "_creationTime" | "_id" | "index" | "rowHash" | "rowJson" | "snapshotId"
>;

/** The keys that place one set in the catalog, shared by its sections. */
type SetKeys = Pick<
  typeof CatalogSetSchema.Type,
  "countryKey" | "examKey" | "setKey" | "trackKey"
>;

/**
 * The locale-free identity of one set: its country, exam, track and set keys.
 * The set row and each of its section rows store it, so a set reads itself and
 * its sections in one query, and an attempt names its set by it.
 */
export function catalogSetIdentity(row: SetKeys) {
  return Arr.join([row.countryKey, row.examKey, row.trackKey, row.setKey], "/");
}

/** Derives the exact indexed facts stored beside one signed assessment row. */
export function assessmentRowFacts(row: AssessmentRow): AssessmentRowFacts {
  const identity = assessmentRowIdentity(row);
  if (row.kind === "catalog") {
    const node = row.row;
    return {
      appLocale: node.appLocale,
      assetId: node.graph.assetId,
      identity,
      kind: row.kind,
      order: node.order,
      ...(node.publicPath === undefined ? {} : { publicPath: node.publicPath }),
      ...(node.kind === "set" || node.kind === "section"
        ? { setIdentity: catalogSetIdentity(node) }
        : {}),
    };
  }
  if (row.kind === "item" || row.kind === "stimulus") {
    return { identity, kind: row.kind, versionHash: row.version.hash };
  }
  if (row.kind === "key") {
    return { identity, kind: row.kind, versionHash: row.key.version };
  }
  if (row.kind === "explanation") {
    return {
      identity,
      kind: row.kind,
      language: row.explanation.language,
      versionHash: row.explanation.version,
    };
  }
  return { identity, kind: row.kind };
}
