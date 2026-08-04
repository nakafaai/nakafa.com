import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { TryoutCatalogRow } from "@nakafa/aksara-contracts/tryout/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import type { TryoutSectionIdentity } from "@repo/backend/convex/contentRelease/tryout/section";
import type { TryoutSetIdentity } from "@repo/backend/convex/contentRelease/tryout/set";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { Effect } from "effect";

interface TryoutDestinationIdentity extends TryoutSetIdentity {
  readonly requestedSectionPublicPath?: string;
  readonly sectionKey?: TryoutSectionIdentity["sectionKey"];
}

/** Reads only the active signed rows needed to link one retained attempt. */
export const readTryoutDestinationPaths = Effect.fn(
  "tryouts.catalog.readDestinationPaths"
)(function* (ctx: QueryCtx, identity: TryoutDestinationIdentity) {
  const owner = yield* loadTryoutOwner(ctx);
  if (!(owner.managed && owner.selected)) {
    return {
      activeSectionPublicPath: null,
      activeSetPublicPath: null,
      managed: false,
      requestedSectionMatches: null,
    };
  }

  const { snapshotId } = owner.selected;
  const setIdentity = tryoutCatalogIdentity({
    countryKey: identity.countryKey,
    examKey: identity.examKey,
    kind: "set",
    locale: identity.locale,
    setKey: identity.setKey,
    trackKey: identity.trackKey,
  });
  const set = yield* readCatalogRowByIdentity(ctx, snapshotId, setIdentity);
  if (set && set.kind !== "set") {
    return yield* destinationIntegrity(
      "Active try-out set changed its row kind."
    );
  }

  let section: TryoutCatalogRow | null = null;
  let sectionIdentity: string | null = null;
  if (identity.sectionKey) {
    sectionIdentity = tryoutCatalogIdentity({
      countryKey: identity.countryKey,
      examKey: identity.examKey,
      kind: "section",
      locale: identity.locale,
      sectionKey: identity.sectionKey,
      setKey: identity.setKey,
      trackKey: identity.trackKey,
    });
    section = yield* readCatalogRowByIdentity(ctx, snapshotId, sectionIdentity);
    if (section && section.kind !== "section") {
      return yield* destinationIntegrity(
        "Active try-out section changed its row kind."
      );
    }
  }

  let requestedSectionMatches: boolean | null = null;
  if (identity.requestedSectionPublicPath && sectionIdentity) {
    const requested = yield* readCatalogRowByPath(ctx, snapshotId, {
      locale: identity.locale,
      publicPath: identity.requestedSectionPublicPath,
    });
    if (requested) {
      requestedSectionMatches =
        requested.kind === "section" &&
        tryoutCatalogIdentity(requested) === sectionIdentity;
    }
  }

  return {
    activeSectionPublicPath:
      section?.kind === "section" && section.visibility === "visible"
        ? (section.publicPath ?? null)
        : null,
    activeSetPublicPath: set?.publicPath ?? null,
    managed: true,
    requestedSectionMatches,
  };
});

/** Reads and verifies one exact active catalog identity. */
const readCatalogRowByIdentity = Effect.fn(
  "tryouts.catalog.readDestinationIdentity"
)(function* (ctx: QueryCtx, snapshotId: string, identity: string) {
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_identity", (index) =>
        index.eq("snapshotId", snapshotId).eq("identity", identity)
      )
      .unique()
  );
  if (!stored) {
    return null;
  }
  return yield* verifyTryoutCatalog(stored, snapshotId);
});

/** Reads and verifies one exact active public route. */
const readCatalogRowByPath = Effect.fn("tryouts.catalog.readDestinationPath")(
  function* (
    ctx: QueryCtx,
    snapshotId: string,
    input: {
      readonly locale: TryoutSetIdentity["locale"];
      readonly publicPath: string;
    }
  ) {
    const stored = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_locale_and_publicPath", (index) =>
          index
            .eq("snapshotId", snapshotId)
            .eq("locale", input.locale)
            .eq("publicPath", input.publicPath)
        )
        .unique()
    );
    if (!stored) {
      return null;
    }
    return yield* verifyTryoutCatalog(stored, snapshotId);
  }
);

/** Rejects a malformed active destination instead of guessing a route. */
function destinationIntegrity(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", message);
}
