import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { TryoutSource } from "@repo/backend/content/tryout/source";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { Effect, Option } from "effect";

/** Reads and verifies one catalog row by its signed identity. */
export const readTryoutCatalogRowByIdentity = Effect.fn(
  "tryouts.catalog.readRowByIdentity"
)(function* (snapshotId: string, identity: string) {
  const source = yield* TryoutSource;
  const stored = Option.getOrNull(yield* source.identity(snapshotId, identity));
  if (!stored) {
    return null;
  }
  return yield* verifyTryoutCatalog(stored, snapshotId);
});

/** Reads and verifies one catalog row by its localized public path. */
export const readTryoutCatalogRowByPath = Effect.fn(
  "tryouts.catalog.readRowByPath"
)(function* (
  snapshotId: string,
  input: {
    readonly appLocale: AppLocaleCode;
    readonly publicPath: string;
  }
) {
  const source = yield* TryoutSource;
  const stored = Option.getOrNull(
    yield* source.path(snapshotId, input.appLocale, input.publicPath)
  );
  if (!stored) {
    return null;
  }
  return yield* verifyTryoutCatalog(stored, snapshotId);
});
