import type { CatalogRow } from "@nakafa/aksara-contracts/assessment/catalog";
import { loadActiveAssessment } from "@repo/backend/confect/tryouts/active";
import { loadTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import {
  readPublishedCountryPage,
  readPublishedExamPage,
  readPublishedHubPage,
  readPublishedSectionPage,
  readPublishedSetPage,
  readPublishedTrackPage,
} from "@repo/backend/content/tryout/published";
import { readTryoutSetSelection } from "@repo/backend/content/tryout/selection";
import type {
  tryoutHubArgsValidator,
  tryoutPageArgsValidator,
} from "@repo/backend/content/tryout/spec";
import { Array as Arr, Effect, Option } from "effect";

type HubInput = typeof tryoutHubArgsValidator.Type;
type PageInput = typeof tryoutPageArgsValidator.Type;

/**
 * The authored revision a page shows, from its country rows: every row of one catalog source shares
 * one revision, and a catalog without countries has none.
 */
const revisionOf = (rows: readonly Pick<CatalogRow, "sourceRevision">[]) =>
  Option.getOrNull(Option.map(Arr.head(rows), (row) => row.sourceRevision));

/** Reads the localized country-first hub of the active release. */
export const readTryoutHubPage = Effect.fn("tryouts.readHubPage")(function* (
  input: HubInput
) {
  const catalog = yield* loadTryoutCatalog(input.appLocale);
  const page = yield* readPublishedHubPage(catalog);
  return {
    ...page,
    sourceRevision: revisionOf(
      Arr.filter(catalog.rows, (row) => row.kind === "country")
    ),
  };
});

/** Reads one country's exams with the revision of its catalog source. */
export const readTryoutCountryPage = Effect.fn("tryouts.readCountryPage")(
  function* (input: PageInput) {
    const catalog = yield* loadTryoutCatalog(input.appLocale);
    const page = yield* readPublishedCountryPage(catalog, input.publicPath);
    if (!page) {
      return null;
    }
    const country = Arr.filter(
      catalog.rows,
      (row) => row.publicPath === input.publicPath
    );
    return { ...page, sourceRevision: revisionOf(country) };
  }
);

/** Reads one exam page of the active release. */
export const readTryoutExamPage = Effect.fn("tryouts.readExamPage")(function* (
  input: PageInput
) {
  const catalog = yield* loadTryoutCatalog(input.appLocale);
  return yield* readPublishedExamPage(catalog, input.publicPath);
});

/** Reads one track page of the active release. */
export const readTryoutTrackPage = Effect.fn("tryouts.readTrackPage")(
  function* (input: PageInput) {
    const catalog = yield* loadTryoutCatalog(input.appLocale);
    return yield* readPublishedTrackPage(catalog, input.publicPath);
  }
);

/** Reads one set page of the active release from its set-local catalog. */
export const readTryoutSetPage = Effect.fn("tryouts.readSetPage")(function* (
  input: PageInput
) {
  const { snapshotId } = yield* loadActiveAssessment();
  const selection = yield* readTryoutSetSelection({ ...input, snapshotId });
  if (!selection) {
    return null;
  }
  return yield* readPublishedSetPage(selection);
});

/** Reads one visible section page of the active release from its set-local catalog. */
export const readTryoutSectionPage = Effect.fn("tryouts.readSectionPage")(
  function* (input: PageInput) {
    const { snapshotId } = yield* loadActiveAssessment();
    const selection = yield* readTryoutSetSelection({ ...input, snapshotId });
    if (!selection) {
      return null;
    }
    return yield* readPublishedSectionPage(selection);
  }
);
