import { loadTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import { loadTryoutOwner } from "@repo/backend/content/tryout/owner";
import {
  readPublishedCountryPage,
  readPublishedExamPage,
  readPublishedHubPage,
  readPublishedSectionPageFromIndex,
  readPublishedSetPageFromIndex,
  readPublishedTrackPage,
} from "@repo/backend/content/tryout/published";
import { readTryoutSetSelection } from "@repo/backend/content/tryout/selection";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

export const tryoutHubArgsValidator = v.object({
  appLocale: appLocaleValidator,
});
export const tryoutPageArgsValidator = v.object({
  ...tryoutHubArgsValidator.fields,
  publicPath: v.string(),
});
type HubInput = Infer<typeof tryoutHubArgsValidator>;
type PageInput = Infer<typeof tryoutPageArgsValidator>;

/** Reads the complete verified localized country-first hub. */
export const readTryoutHubPage = Effect.fn("tryouts.readHubPage")(function* (
  input: HubInput
) {
  const catalog = yield* loadTryoutCatalog(input.appLocale);
  const page = yield* readPublishedHubPage(catalog);
  return { ...page, sourceRevision: catalog.sourceRevision };
});

/** Reads one country's exams with the exact publication source revision. */
export const readTryoutCountryPage = Effect.fn("tryouts.readCountryPage")(
  function* (input: PageInput) {
    const catalog = yield* loadTryoutCatalog(input.appLocale);
    const page = yield* readPublishedCountryPage(catalog, input.publicPath);
    return page ? { ...page, sourceRevision: catalog.sourceRevision } : null;
  }
);

/** Resolves one exam against its complete signed hierarchy. */
export const readTryoutExamPage = Effect.fn("tryouts.readExamPage")(function* (
  input: PageInput
) {
  const catalog = yield* loadTryoutCatalog(input.appLocale);
  return yield* readPublishedExamPage(catalog, input.publicPath);
});

/** Resolves one track against its complete signed hierarchy. */
export const readTryoutTrackPage = Effect.fn("tryouts.readTrackPage")(
  function* (input: PageInput) {
    const catalog = yield* loadTryoutCatalog(input.appLocale);
    return yield* readPublishedTrackPage(catalog, input.publicPath);
  }
);

/** Resolves a set with only its verified parents and ordered sections. */
export const readTryoutSetPage = Effect.fn("tryouts.readSetPage")(function* (
  input: PageInput
) {
  const owner = yield* loadTryoutOwner();
  const index = yield* readTryoutSetSelection({
    ...input,
    snapshotId: owner.snapshotId,
  });
  if (!index) {
    return null;
  }
  return yield* readPublishedSetPageFromIndex(index, input.publicPath);
});

/** Resolves one public section through the exact active set selection. */
export const readTryoutSectionPage = Effect.fn("tryouts.readSectionPage")(
  function* (input: PageInput) {
    const owner = yield* loadTryoutOwner();
    const index = yield* readTryoutSetSelection({
      ...input,
      snapshotId: owner.snapshotId,
    });
    if (!index) {
      return null;
    }
    return yield* readPublishedSectionPageFromIndex(index, input.publicPath);
  }
);
