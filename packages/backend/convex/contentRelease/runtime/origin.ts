import type { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import type { Effect } from "effect";

type ActiveIdentity = NonNullable<
  Effect.Effect.Success<ReturnType<typeof loadActiveIdentity>>
>;

/** Returns immutable Git provenance only for a source-backed release. */
export function readSourceRevision(active: ActiveIdentity) {
  return active.signed.manifest.origin.kind === "git"
    ? active.signed.manifest.origin.sha
    : null;
}
