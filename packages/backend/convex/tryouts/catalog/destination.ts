import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { TryoutCatalogRow } from "@nakafa/aksara-contracts/tryout/catalog";
import {
  tryoutCatalogIdentity,
  tryoutCatalogNodeIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import type { TryoutSectionIdentity } from "@repo/backend/convex/contentRelease/tryout/section";
import type { TryoutSetIdentity } from "@repo/backend/convex/contentRelease/tryout/set";
import {
  readPublishedEntrySection,
  toPublicPublishedSection,
} from "@repo/backend/convex/tryouts/catalog/published";
import {
  readTryoutCatalogRowByIdentity,
  readTryoutCatalogRowByPath,
} from "@repo/backend/convex/tryouts/catalog/row";
import { readTryoutSetSections } from "@repo/backend/convex/tryouts/catalog/selection";
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
  const { snapshotId } = owner;
  const setIdentity = tryoutCatalogNodeIdentity({
    appLocale: AppLocaleSchema.make(identity.locale),
    countryKey: identity.countryKey,
    examKey: identity.examKey,
    kind: "set",
    setKey: identity.setKey,
    trackKey: identity.trackKey,
  });
  const set = yield* readTryoutCatalogRowByIdentity(
    ctx,
    snapshotId,
    setIdentity
  );
  if (set && set.kind !== "set") {
    return yield* destinationIntegrity(
      "Active try-out set changed its row kind."
    );
  }

  let section: TryoutCatalogRow | null = null;
  let sectionIdentity: string | null = null;
  if (identity.sectionKey) {
    const selectedSectionIdentity = tryoutCatalogNodeIdentity({
      appLocale: AppLocaleSchema.make(identity.locale),
      countryKey: identity.countryKey,
      examKey: identity.examKey,
      kind: "section",
      sectionKey: identity.sectionKey,
      setKey: identity.setKey,
      trackKey: identity.trackKey,
    });
    sectionIdentity = selectedSectionIdentity;
    section = yield* readTryoutCatalogRowByIdentity(
      ctx,
      snapshotId,
      selectedSectionIdentity
    );
    if (section && section.kind !== "section") {
      return yield* destinationIntegrity(
        "Active try-out section changed its row kind."
      );
    }
  }

  let requestedSectionMatches: boolean | null = null;
  if (identity.requestedSectionPublicPath && sectionIdentity) {
    const requested = yield* readTryoutCatalogRowByPath(ctx, snapshotId, {
      appLocale: identity.locale,
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
    requestedSectionMatches,
  };
});

/** Rejects a malformed active destination instead of guessing a route. */
function destinationIntegrity(message: string) {
  return releaseFail("CONTENT_RELEASE_INTEGRITY", message);
}

/** Resolves one current signed restart target from a frozen set identity. */
export const readActiveTryoutRestartTarget = Effect.fn(
  "tryouts.catalog.readActiveRestartTarget"
)(function* (ctx: QueryCtx, identity: TryoutSetIdentity) {
  const owner = yield* loadTryoutOwner(ctx);
  const setIdentity = tryoutCatalogNodeIdentity({
    appLocale: AppLocaleSchema.make(identity.locale),
    countryKey: identity.countryKey,
    examKey: identity.examKey,
    kind: "set",
    setKey: identity.setKey,
    trackKey: identity.trackKey,
  });
  const set = yield* readTryoutCatalogRowByIdentity(
    ctx,
    owner.snapshotId,
    setIdentity
  );
  if (!set) {
    return null;
  }
  if (set.kind !== "set") {
    return yield* destinationIntegrity(
      "Active try-out set changed its row kind."
    );
  }

  const sectionRecords = yield* readTryoutSetSections(
    ctx,
    owner.snapshotId,
    set
  );
  const sections = sectionRecords.map(({ row }) => row);
  const visibleSections = sections.filter(
    (section) => section.visibility === "visible"
  );
  const entrySection = yield* readPublishedEntrySection(
    set,
    sections,
    visibleSections
  );
  if (!entrySection) {
    return null;
  }

  return {
    entrySection: toPublicPublishedSection(entrySection),
    setPublicPath: set.publicPath,
  };
});
