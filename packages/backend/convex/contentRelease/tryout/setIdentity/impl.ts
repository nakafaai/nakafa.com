import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { tryoutCatalogSetIdentity } from "@repo/backend/convex/contentRelease/tryout/facts";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { Effect } from "effect";

const TRYOUT_SET_IDENTITY_LIMIT = 100;

type CatalogRow = Doc<"tryoutCatalog">;

interface MigrationCandidate {
  readonly row: CatalogRow;
  readonly setIdentity: string;
}

/** Validates the operator-provided migration bound. */
function validateExpectedMissing(expectedMissing: number) {
  if (
    !Number.isInteger(expectedMissing) ||
    expectedMissing < 0 ||
    expectedMissing > TRYOUT_SET_IDENTITY_LIMIT
  ) {
    return releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Try-out set-identity migration expects between 0 and ${TRYOUT_SET_IDENTITY_LIMIT} missing rows.`
    );
  }

  return Effect.void;
}

/** Authenticates one catalog row and classifies its migration state. */
const classifyCatalogRow = Effect.fn(
  "contentRelease.classifyTryoutSetIdentity"
)(function* (row: CatalogRow) {
  const verified = yield* verifyTryoutCatalog(row, row.snapshotId);
  const setIdentity = tryoutCatalogSetIdentity(verified);

  if (setIdentity === undefined) {
    if (row.setIdentity !== undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Try-out catalog row ${row.identity} has an unexpected set identity.`
      );
    }

    return;
  }

  if (row.setIdentity === undefined) {
    return { row, setIdentity };
  }

  if (row.setIdentity !== setIdentity) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out catalog row ${row.identity} has an invalid set identity.`
    );
  }
});

/** Audits or migrates the bounded signed try-out catalog set identities. */
export const migrateTryoutSetIdentity = Effect.fn(
  "contentRelease.migrateTryoutSetIdentity"
)(function* (
  ctx: MutationCtx,
  input: { readonly apply: boolean; readonly expectedMissing: number }
) {
  yield* validateExpectedMissing(input.expectedMissing);

  const rows = yield* Effect.promise(() =>
    ctx.db.query("tryoutCatalog").take(TRYOUT_SET_IDENTITY_LIMIT + 1)
  );
  if (rows.length > TRYOUT_SET_IDENTITY_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Try-out set-identity migration exceeds ${TRYOUT_SET_IDENTITY_LIMIT} catalog rows.`
    );
  }

  const candidates: MigrationCandidate[] = [];
  for (const row of rows) {
    const candidate = yield* classifyCatalogRow(row);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  if (candidates.length !== input.expectedMissing) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Try-out set-identity migration found ${candidates.length} missing rows instead of ${input.expectedMissing}.`
    );
  }

  if (input.apply) {
    for (const { row, setIdentity } of candidates) {
      yield* Effect.promise(() =>
        ctx.db.patch("tryoutCatalog", row._id, { setIdentity })
      );
    }
  }

  return {
    candidates: candidates.length,
    updated: input.apply ? candidates.length : 0,
  };
});
