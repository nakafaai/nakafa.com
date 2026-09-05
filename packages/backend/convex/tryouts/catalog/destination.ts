import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { TryoutCatalogRow } from "@nakafa/aksara-contracts/tryout/catalog";
import {
  tryoutCatalogIdentity,
  tryoutCatalogNodeIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import { loadTryoutOwner } from "@repo/backend/content/tryout/owner";
import {
  readPublishedEntrySection,
  toPublicPublishedSection,
} from "@repo/backend/content/tryout/published";
import {
  readTryoutCatalogRowByIdentity,
  readTryoutCatalogRowByPath,
} from "@repo/backend/content/tryout/row";
import type { TryoutSectionIdentity } from "@repo/backend/content/tryout/section";
import { readTryoutSetSections } from "@repo/backend/content/tryout/selection";
import type { TryoutSetIdentity } from "@repo/backend/content/tryout/set";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

interface TryoutDestinationIdentity extends TryoutSetIdentity {
  readonly requestedSectionPublicPath?: string;
  readonly sectionKey?: TryoutSectionIdentity["sectionKey"];
}

/** Reads only the active signed rows needed to link one retained attempt. */
export const readTryoutDestinationPaths = Effect.fn(
  "tryouts.catalog.readDestinationPaths"
)(function* (ctx: QueryCtx, identity: TryoutDestinationIdentity) {
  const owner = yield* loadTryoutOwner().pipe(
    Effect.provide(convexTryoutLayer(ctx))
  );
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
    snapshotId,
    setIdentity
  ).pipe(Effect.provide(convexTryoutLayer(ctx)));
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
      snapshotId,
      selectedSectionIdentity
    ).pipe(Effect.provide(convexTryoutLayer(ctx)));
  }

  let requestedSectionMatches: boolean | null = null;
  if (identity.requestedSectionPublicPath && sectionIdentity) {
    const requested = yield* readTryoutCatalogRowByPath(snapshotId, {
      appLocale: identity.locale,
      publicPath: identity.requestedSectionPublicPath,
    }).pipe(Effect.provide(convexTryoutLayer(ctx)));
    if (requested) {
      requestedSectionMatches =
        requested.kind === "section" &&
        tryoutCatalogIdentity(requested) === sectionIdentity;
    }
  }

  const activeSectionPublicPath =
    section?.kind === "section" && section.visibility === "visible"
      ? yield* Effect.fromNullishOr(section.publicPath).pipe(Effect.orDie)
      : null;
  return {
    activeSectionPublicPath,
    activeSetPublicPath: set?.publicPath ?? null,
    requestedSectionMatches,
  };
});

/** Resolves one current signed restart target from a frozen set identity. */
export const readActiveTryoutRestartTarget = Effect.fn(
  "tryouts.catalog.readActiveRestartTarget"
)(function* (ctx: QueryCtx, identity: TryoutSetIdentity) {
  const owner = yield* loadTryoutOwner().pipe(
    Effect.provide(convexTryoutLayer(ctx))
  );
  const setIdentity = tryoutCatalogNodeIdentity({
    appLocale: AppLocaleSchema.make(identity.locale),
    countryKey: identity.countryKey,
    examKey: identity.examKey,
    kind: "set",
    setKey: identity.setKey,
    trackKey: identity.trackKey,
  });
  const set = yield* readTryoutCatalogRowByIdentity(
    owner.snapshotId,
    setIdentity
  ).pipe(Effect.provide(convexTryoutLayer(ctx)));
  // Exact node identity and indexed-fact verification bind a present row's kind.
  if (set?.kind !== "set") {
    return null;
  }

  const sectionRecords = yield* readTryoutSetSections(
    owner.snapshotId,
    set
  ).pipe(Effect.provide(convexTryoutLayer(ctx)));
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
