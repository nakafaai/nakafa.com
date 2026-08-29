import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadVerifiedSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import type { TryoutSetIdentity } from "@repo/backend/convex/contentRelease/tryout/set";
import {
  readPublishedSectionPageFromIndex,
  readPublishedSetPageFromIndex,
} from "@repo/backend/convex/tryouts/catalog/published";
import {
  readTryoutSetSelection,
  type TryoutSetSelection,
} from "@repo/backend/convex/tryouts/catalog/selection";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import {
  matchesAttemptIdentity,
  readAttemptSetIdentity,
} from "@repo/backend/convex/tryouts/runtime/lookup";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;

interface AttemptPath {
  readonly locale: AppLocaleCode;
  readonly publicPath: string;
}

/** Reads and verifies one set page from the attempt-owned source snapshot. */
export const readAttemptSetPage = Effect.fn("tryouts.attempt.readSetPage")(
  function* (
    ctx: QueryCtx,
    args: AttemptPath,
    attempt: TryoutAttempt,
    identity: TryoutSetIdentity
  ) {
    const selection = yield* readAttemptSetSelection(
      ctx,
      args,
      attempt,
      identity
    );
    const page = yield* readPublishedSetPageFromIndex(
      selection,
      args.publicPath
    );
    if (!(page && matchesSetPage(attempt, identity, page))) {
      return yield* attemptPageIntegrity(
        "Frozen try-out set page no longer matches its attempt snapshot."
      );
    }
    return page;
  }
);

/** Reads and verifies one section page from the attempt-owned source snapshot. */
export const readAttemptSectionPage = Effect.fn(
  "tryouts.attempt.readSectionPage"
)(function* (ctx: QueryCtx, args: AttemptPath, attempt: TryoutAttempt) {
  const identity = readAttemptSetIdentity(attempt);
  const selection = yield* readAttemptSetSelection(
    ctx,
    args,
    attempt,
    identity
  );
  const page = yield* readPublishedSectionPageFromIndex(
    selection,
    args.publicPath
  );
  if (!(page && matchesSectionPage(attempt, identity, page))) {
    return yield* attemptPageIntegrity(
      "Frozen try-out section page no longer matches its attempt snapshot."
    );
  }
  return page;
});

/** Reads and checks the complete immutable set-local catalog for one attempt. */
const readAttemptSetSelection = Effect.fn("tryouts.attempt.readSetSelection")(
  function* (
    ctx: QueryCtx,
    args: AttemptPath,
    attempt: TryoutAttempt,
    identity: TryoutSetIdentity
  ) {
    yield* loadVerifiedSnapshot(ctx, "tryout", attempt.tryoutSnapshotId);
    const selection = yield* readTryoutSetSelection(ctx, {
      appLocale: args.locale,
      publicPath: args.publicPath,
      snapshotId: attempt.tryoutSnapshotId,
    });
    if (!(selection && matchesAttemptSelection(attempt, identity, selection))) {
      return yield* attemptPageIntegrity(
        "Frozen try-out catalog no longer matches its attempt snapshot."
      );
    }
    return selection;
  }
);

/** Checks every attempt-owned set and section field against signed source rows. */
function matchesAttemptSelection(
  attempt: TryoutAttempt,
  identity: TryoutSetIdentity,
  selection: TryoutSetSelection
) {
  const set = selection.sets.at(0);
  if (
    !set ||
    selection.sets.length !== 1 ||
    set.appLocale !== identity.locale ||
    !matchesAttemptIdentity(identity, {
      countryKey: set.countryKey,
      examKey: set.examKey,
      locale: identity.locale,
      setKey: set.setKey,
      trackKey: set.trackKey,
    }) ||
    tryoutCatalogIdentity(set) !== attempt.setIdentity ||
    set.publicPath !== attempt.setPublicPath ||
    set.questionCount !== attempt.totalQuestions ||
    set.scoringStrategy !== attempt.scoringStrategy ||
    set.sectionCount !== attempt.sectionSnapshots.length ||
    selection.sectionRecords.length !== attempt.sectionSnapshots.length
  ) {
    return false;
  }

  return attempt.sectionSnapshots.every((snapshot) => {
    const record = selection.sectionRecords.find(
      ({ row }) => tryoutCatalogIdentity(row) === snapshot.sectionIdentity
    );
    if (!record) {
      return false;
    }
    const { row } = record;
    return (
      record.rowHash === snapshot.sectionRowHash &&
      row.order === snapshot.sectionOrder &&
      row.publicPath === snapshot.publicPath &&
      row.questionCount === snapshot.questionCount &&
      row.questionSourcePath === snapshot.questionSourcePath &&
      row.sectionKey === snapshot.sectionKey &&
      row.sourceRevision === snapshot.sourceRevision &&
      row.timeLimitSeconds === snapshot.timeLimitSeconds
    );
  });
}

/** Checks one frozen page against the attempt's immutable set snapshot. */
function matchesSetPage(
  attempt: TryoutAttempt,
  identity: TryoutSetIdentity,
  page: {
    readonly entrySection: {
      readonly publicPath?: string;
      readonly questionCount: number;
      readonly sectionKey: string;
      readonly timeLimitSeconds: number;
      readonly visibility: "internal-entry" | "visible";
    } | null;
    readonly sections: readonly {
      readonly publicPath?: string;
      readonly questionCount: number;
      readonly sectionKey: string;
      readonly timeLimitSeconds: number;
    }[];
    readonly set: {
      readonly countryKey: string;
      readonly examKey: string;
      readonly publicPath: string;
      readonly setKey: string;
      readonly totalQuestionCount: number;
      readonly trackKey: string;
    };
  }
) {
  const pageIdentity = {
    countryKey: page.set.countryKey,
    examKey: page.set.examKey,
    locale: identity.locale,
    setKey: page.set.setKey,
    trackKey: page.set.trackKey,
  };
  if (
    !matchesAttemptIdentity(identity, pageIdentity) ||
    page.set.publicPath !== attempt.setPublicPath ||
    page.set.totalQuestionCount !== attempt.totalQuestions
  ) {
    return false;
  }

  const sections =
    page.entrySection?.visibility === "internal-entry"
      ? [page.entrySection, ...page.sections]
      : page.sections;
  if (sections.length !== attempt.sectionSnapshots.length) {
    return false;
  }
  return attempt.sectionSnapshots.every((snapshot) => {
    const section = sections.find(
      (candidate) => candidate.sectionKey === snapshot.sectionKey
    );
    if (!section) {
      return false;
    }
    return (
      section.publicPath === snapshot.publicPath &&
      section.questionCount === snapshot.questionCount &&
      section.timeLimitSeconds === snapshot.timeLimitSeconds
    );
  });
}

/** Checks one frozen section projection against its exact route. */
function matchesSectionPage(
  attempt: TryoutAttempt,
  identity: TryoutSetIdentity,
  page: {
    readonly section: {
      readonly publicPath?: string;
      readonly questionCount: number;
      readonly sectionKey: string;
      readonly timeLimitSeconds: number;
    };
    readonly set: {
      readonly countryKey: string;
      readonly examKey: string;
      readonly publicPath: string;
      readonly setKey: string;
      readonly trackKey: string;
    };
  }
) {
  const snapshot = attempt.sectionSnapshots.find(
    (candidate) => candidate.publicPath === page.section.publicPath
  );
  if (!snapshot) {
    return false;
  }
  const pageIdentity = {
    countryKey: page.set.countryKey,
    examKey: page.set.examKey,
    locale: identity.locale,
    setKey: page.set.setKey,
    trackKey: page.set.trackKey,
  };
  return (
    matchesAttemptIdentity(identity, pageIdentity) &&
    page.set.publicPath === attempt.setPublicPath &&
    page.section.sectionKey === snapshot.sectionKey &&
    page.section.questionCount === snapshot.questionCount &&
    page.section.timeLimitSeconds === snapshot.timeLimitSeconds
  );
}

/** Rejects any drift inside an immutable attempt-owned page. */
function attemptPageIntegrity(message: string) {
  return new TryoutRuntimeError({
    code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
    message,
  });
}
