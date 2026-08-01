import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import { toTryoutCorpusPath } from "@repo/backend/convex/contentRelease/tryout/path";
import {
  readTryoutSet,
  type VerifiedTryoutSet,
} from "@repo/backend/convex/contentRelease/tryout/set";
import {
  TryoutStartError,
  toTryoutStartError,
  tryoutStartErrorCode,
} from "@repo/backend/convex/tryouts/start/spec";
import { Effect } from "effect";

type LegacySection = Doc<"tryoutSections">;
type LegacySet = Doc<"tryoutSets">;
type SignedSection = VerifiedTryoutSet["sections"][number];

/** One legacy section paired with its authenticated signed replacement. */
export interface AlignedTryoutSection {
  readonly legacy: LegacySection;
  readonly signed: SignedSection;
}

/** Local rows used only until signed try-out ownership is activated. */
export interface LocalTryoutSource {
  readonly kind: "local";
  readonly sections: readonly LegacySection[];
}

/** Signed section rows authenticated against one immutable snapshot. */
export interface SignedSectionSource {
  readonly kind: "signed";
  readonly sections: readonly AlignedTryoutSection[];
}

/** Placement source selected by the explicit publication ownership mode. */
export type TryoutSectionSource = LocalTryoutSource | SignedSectionSource;

/** Signed rows required after Aksara try-out ownership is activated. */
export interface SignedTryoutSource extends SignedSectionSource {
  readonly snapshot: VerifiedTryoutSet;
}

/** Explicit source selected from the active publication ownership state. */
export type TryoutStartSource = LocalTryoutSource | SignedTryoutSource;

/** Selects local rows before activation and fails closed afterward. */
export const loadTryoutStartSource = Effect.fn(
  "tryouts.start.loadTryoutStartSource"
)(function* (
  ctx: QueryCtx,
  localSet: LegacySet,
  localSections: readonly LegacySection[]
) {
  const owner = yield* loadTryoutOwner(ctx).pipe(
    Effect.mapError(toTryoutStartError)
  );
  if (!owner.managed) {
    const source: TryoutStartSource = {
      kind: "local",
      sections: localSections,
    };
    return source;
  }

  const snapshot = yield* readTryoutSet(ctx, localSet).pipe(
    Effect.mapError(toTryoutStartError)
  );
  const sections = yield* alignTryoutSource(localSet, localSections, snapshot);
  const source: TryoutStartSource = { kind: "signed", sections, snapshot };
  return source;
});

/** Proves that the active legacy and signed set snapshots are identical. */
export const alignTryoutSource = Effect.fn("tryouts.start.alignTryoutSource")(
  function* (
    legacySet: LegacySet,
    legacySections: readonly LegacySection[],
    signed: VerifiedTryoutSet
  ) {
    const setMismatch = findSetMismatch(legacySet, signed);
    if (setMismatch) {
      return yield* sourceMismatch(`set ${setMismatch}`);
    }
    if (legacySections.length !== signed.sections.length) {
      return yield* sourceMismatch("section count");
    }

    const sections: AlignedTryoutSection[] = [];
    for (const [index, legacy] of legacySections.entries()) {
      const signedSection = signed.sections[index];
      if (!signedSection) {
        return yield* sourceMismatch(`section ${index + 1}`);
      }
      const sectionMismatch = findSectionMismatch(
        legacy,
        legacySet,
        signedSection
      );
      if (sectionMismatch) {
        return yield* sourceMismatch(
          `section ${legacy.sectionKey} ${sectionMismatch}`
        );
      }
      sections.push({ legacy, signed: signedSection });
    }

    return sections;
  }
);

/** Finds the first authored set field that differs across both sources. */
function findSetMismatch(legacy: LegacySet, signed: VerifiedTryoutSet) {
  const row = signed.set.row;
  if (legacy.countryKey !== row.countryKey) {
    return "countryKey";
  }
  if (legacy.examKey !== row.examKey) {
    return "examKey";
  }
  if (legacy.trackKey !== row.trackKey) {
    return "trackKey";
  }
  if (legacy.setKey !== row.setKey) {
    return "setKey";
  }
  if (legacy.locale !== row.locale) {
    return "locale";
  }
  if (legacy.publicPath !== row.publicPath) {
    return "publicPath";
  }
  if (legacy.title !== row.title) {
    return "title";
  }
  if (legacy.description !== row.description) {
    return "description";
  }
  if (legacy.scoringStrategy !== row.scoringStrategy) {
    return "scoringStrategy";
  }
  if (legacy.internalEntrySectionKey !== row.internalEntrySectionKey) {
    return "internalEntrySectionKey";
  }
  if (legacy.sectionCount !== row.sectionCount) {
    return "sectionCount";
  }
  if (legacy.totalQuestionCount !== row.questionCount) {
    return "questionCount";
  }
  if (legacy.readyQuestionCount !== row.questionCount) {
    return "readyQuestionCount";
  }
  if (legacy.visibleSectionCount !== row.visibleSectionCount) {
    return "visibleSectionCount";
  }
  if (legacy.readyVisibleSectionCount !== row.visibleSectionCount) {
    return "readyVisibleSectionCount";
  }
  if (legacy.order !== row.order) {
    return "order";
  }
  if (legacy.sourceRevision !== row.sourceRevision) {
    return "sourceRevision";
  }
  return;
}

/** Finds the first authored section field that differs across both sources. */
function findSectionMismatch(
  legacy: LegacySection,
  legacySet: LegacySet,
  signed: SignedSection
) {
  const row = signed.section.row;
  if (legacy.tryoutSetId !== legacySet._id) {
    return "tryoutSetId";
  }
  if (legacy.countryKey !== row.countryKey) {
    return "countryKey";
  }
  if (legacy.examKey !== row.examKey) {
    return "examKey";
  }
  if (legacy.trackKey !== row.trackKey) {
    return "trackKey";
  }
  if (legacy.setKey !== row.setKey) {
    return "setKey";
  }
  if (legacy.sectionKey !== row.sectionKey) {
    return "sectionKey";
  }
  if (legacy.locale !== row.locale) {
    return "locale";
  }
  if (legacy.publicPath !== row.publicPath) {
    return "publicPath";
  }
  if (legacy.title !== row.title) {
    return "title";
  }
  if (legacy.description !== row.description) {
    return "description";
  }
  if (legacy.questionCount !== row.questionCount) {
    return "questionCount";
  }
  if (legacy.order !== row.order) {
    return "order";
  }
  if (legacy.sourceRevision !== row.sourceRevision) {
    return "sourceRevision";
  }
  if (legacy.timeLimitSeconds !== row.timeLimitSeconds) {
    return "timeLimitSeconds";
  }
  if (legacy.visibility !== row.visibility) {
    return "visibility";
  }
  if (
    toTryoutCorpusPath(legacy.questionSourcePath) !== row.questionSourcePath
  ) {
    return "questionSourcePath";
  }
  return;
}

/** Raises one typed fail-closed source drift error. */
function sourceMismatch(field: string) {
  return new TryoutStartError({
    code: tryoutStartErrorCode.sectionSnapshotMismatch,
    message: `Legacy and signed try-out sources differ at ${field}.`,
  });
}
