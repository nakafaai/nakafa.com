import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { EXACT_SCOPE_LIMIT } from "@repo/backend/convex/contentRelease/spec";

/** Maximum permanent material identities rebuilt by one baseline mutation. */
export const MATERIAL_BASELINE_LIMIT = 8;

/** Worst-case catalog, head, route, and existing-row reads per identity. */
export const MATERIAL_IDENTITY_READ_LIMIT = 6;

/** Maximum lesson sections returned for one localized material group. */
export const MATERIAL_GROUP_LIMIT = 100;

/** Maximum source groups reconciled by one material-shell query. */
export const MATERIAL_SOURCE_GROUP_LIMIT = 2;

/** Maximum source identities decoded by one material-shell query. */
export const MATERIAL_SOURCE_LIMIT =
  MATERIAL_GROUP_LIMIT * MATERIAL_SOURCE_GROUP_LIMIT + APP_LOCALE_CODES.length;

/**
 * Maximum exact owners in one locale within the complete release scope.
 */
export const MATERIAL_EXACT_LOCALE_LIMIT = Math.floor(
  EXACT_SCOPE_LIMIT / APP_LOCALE_CODES.length
);
