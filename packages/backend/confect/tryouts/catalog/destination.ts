import { loadActiveAssessment } from "@repo/backend/confect/tryouts/active";
import {
  readCatalogNode,
  readCatalogSet,
} from "@repo/backend/confect/tryouts/catalog/rows";
import {
  type TryoutSetIdentity,
  tryoutRouteKeyValidator,
  tryoutSetIdentityOf,
  tryoutSetIdentityValidator,
} from "@repo/backend/confect/tryouts/route";
import { readSetFacts } from "@repo/backend/content/tryout/facts";
import {
  readPublishedEntrySection,
  toPublicPublishedSection,
} from "@repo/backend/content/tryout/published";
import { Effect, HashMap, Option, Schema } from "effect";

const TryoutDestinationIdentitySchema = Schema.Struct({
  ...tryoutSetIdentityValidator.fields,
  sectionKey: tryoutRouteKeyValidator,
});
type TryoutDestinationIdentity = typeof TryoutDestinationIdentitySchema.Type;

/**
 * Reads the routes of the active release that link one retained attempt: its set's, and its
 * section's when that section shows a page of its own. Either is none when the active release no
 * longer publishes it in that locale.
 */
export const readTryoutDestinationPaths = Effect.fn(
  "tryouts.catalog.readDestinationPaths"
)(function* (identity: TryoutDestinationIdentity) {
  const { snapshotId } = yield* loadActiveAssessment();
  const keys = {
    appLocale: identity.locale,
    countryKey: identity.countryKey,
    examKey: identity.examKey,
    setKey: identity.setKey,
    trackKey: identity.trackKey,
  };
  const [set, section] = yield* Effect.all([
    readCatalogNode(snapshotId, { ...keys, kind: "set" }),
    readCatalogNode(snapshotId, {
      ...keys,
      kind: "section",
      sectionKey: identity.sectionKey,
    }),
  ]);
  return {
    activeSectionPublicPath: Option.getOrNull(
      Option.flatMap(section, (row) => Option.fromUndefinedOr(row.publicPath))
    ),
    activeSetPublicPath: Option.getOrNull(
      Option.map(set, (row) => row.publicPath)
    ),
  };
});

/**
 * Resolves where a retained attempt's set restarts in the active release: the set's route and its
 * entry section, none when the active release no longer publishes the set in that locale.
 */
export const readActiveTryoutRestartTarget = Effect.fn(
  "tryouts.catalog.readActiveRestartTarget"
)(function* (identity: TryoutSetIdentity) {
  const { snapshotId } = yield* loadActiveAssessment();
  const found = yield* readCatalogSet(
    snapshotId,
    tryoutSetIdentityOf(identity),
    identity.locale
  );
  if (Option.isNone(found)) {
    return null;
  }
  const { sections, set } = found.value;
  const entry = yield* readPublishedEntrySection(set, sections);
  const facts = yield* Effect.fromOption(
    HashMap.get(
      yield* readSetFacts(snapshotId, [set]),
      tryoutSetIdentityOf(set)
    )
  ).pipe(
    // The facts were read for this one set.
    Effect.orDie
  );
  return {
    entrySection: yield* toPublicPublishedSection(entry, facts),
    setPublicPath: set.publicPath,
  };
});
