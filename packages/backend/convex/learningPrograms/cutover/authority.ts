import type { LearningProgram } from "@nakafa/aksara-contracts/program/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { isLearningProgramSelectable } from "@repo/backend/convex/learningPrograms/selection";
import { programMatchesInterest } from "@repo/backend/convex/learningPrograms/spec";
import type { LearningInterest } from "@repo/contents/_types/program/schema";

interface ResolvedLearningSelection {
  readonly interest: LearningInterest;
  readonly program: LearningProgram;
}

type ExactProgramIdentity =
  | { readonly _tag: "Conflict" }
  | { readonly _tag: "Resolved"; readonly key: string | null };

type LegacySelectionResolution =
  | { readonly _tag: "Conflict" }
  | { readonly _tag: "Missing" }
  | {
      readonly _tag: "Resolved";
      readonly selection: ResolvedLearningSelection;
    };

export type LearningSelectionAuthority =
  | {
      readonly _tag: "Canonical";
      readonly selection: ResolvedLearningSelection;
    }
  | {
      readonly _tag: "Legacy";
      readonly selection: ResolvedLearningSelection;
    }
  | {
      readonly _tag: "Unresolved";
      readonly reason:
        | "ambiguous-write-order"
        | "conflicting-program-identities"
        | "missing-valid-selection";
    };

/** Resolves the only selection whose identity and write order are authoritative. */
export function resolveLearningSelectionAuthority({
  legacyProgram,
  preference,
  profile,
  programs,
}: {
  readonly legacyProgram: Doc<"learningPrograms"> | null;
  readonly preference: Doc<"learningPreferences"> | null;
  readonly profile: Doc<"learningProfiles">;
  readonly programs: readonly LearningProgram[];
}): LearningSelectionAuthority {
  const legacyResolution = readLegacySelection(
    profile,
    legacyProgram,
    programs
  );

  if (legacyResolution._tag === "Conflict") {
    return {
      _tag: "Unresolved",
      reason: "conflicting-program-identities",
    };
  }

  const canonicalSelection = readCanonicalSelection(preference, programs);
  const legacySelection =
    legacyResolution._tag === "Resolved" ? legacyResolution.selection : null;

  if (!(canonicalSelection && preference)) {
    if (legacySelection) {
      return { _tag: "Legacy", selection: legacySelection };
    }

    return { _tag: "Unresolved", reason: "missing-valid-selection" };
  }

  const authority = getSelectionAuthority({
    canonicalSelection,
    legacySelection,
    preference,
    profile,
  });

  if (authority === "canonical") {
    return { _tag: "Canonical", selection: canonicalSelection };
  }

  if (authority === "legacy" && legacySelection) {
    return { _tag: "Legacy", selection: legacySelection };
  }

  return { _tag: "Unresolved", reason: "ambiguous-write-order" };
}

/** Resolves one exact retained identity or rejects conflicting legacy keys. */
function readExactProgramKey(
  profile: Doc<"learningProfiles">,
  legacyProgram: Doc<"learningPrograms"> | null
): ExactProgramIdentity {
  if (
    profile.programKey !== undefined &&
    legacyProgram !== null &&
    profile.programKey !== legacyProgram.key
  ) {
    return { _tag: "Conflict" };
  }

  return {
    _tag: "Resolved",
    key: profile.programKey ?? legacyProgram?.key ?? null,
  };
}

/** Reads one signed canonical identity without conflating it with selectability. */
function readCanonicalSelection(
  preference: Doc<"learningPreferences"> | null,
  programs: readonly LearningProgram[]
) {
  if (!(preference?.learningInterest && preference.primaryProgramKey)) {
    return null;
  }

  const program = programs.find(
    (candidate) => candidate.key === preference.primaryProgramKey
  );

  if (
    !(
      program &&
      programMatchesInterest(program.kind, preference.learningInterest)
    )
  ) {
    return null;
  }

  return { interest: preference.learningInterest, program };
}

/** Resolves the old writer's first compatible interest against its exact key. */
function readLegacySelection(
  profile: Doc<"learningProfiles">,
  legacyProgram: Doc<"learningPrograms"> | null,
  programs: readonly LearningProgram[]
): LegacySelectionResolution {
  const interests = orderLegacyInterests(profile.interests, legacyProgram);
  const exactIdentity = readExactProgramKey(profile, legacyProgram);

  if (exactIdentity._tag === "Conflict") {
    return exactIdentity;
  }

  if (exactIdentity.key !== null) {
    for (const interest of interests) {
      const exactProgram = programs.find(
        (program) =>
          program.key === exactIdentity.key &&
          isLearningProgramSelectable(program) &&
          programMatchesInterest(program.kind, interest)
      );

      if (exactProgram) {
        return {
          _tag: "Resolved",
          selection: { interest, program: exactProgram },
        };
      }
    }

    return { _tag: "Missing" };
  }

  for (const interest of interests) {
    const candidates = programs.filter(
      (program) =>
        isLearningProgramSelectable(program) &&
        programMatchesInterest(program.kind, interest)
    );

    if (candidates.length === 1) {
      return {
        _tag: "Resolved",
        selection: { interest, program: candidates[0] },
      };
    }
  }

  return { _tag: "Missing" };
}

/** Prioritizes interests compatible with the program the learner selected. */
function orderLegacyInterests(
  interests: readonly LearningInterest[],
  legacyProgram: Doc<"learningPrograms"> | null
) {
  const uniqueInterests = Array.from(new Set(interests));

  if (!legacyProgram) {
    return uniqueInterests;
  }

  return [
    ...uniqueInterests.filter((interest) =>
      programMatchesInterest(legacyProgram.kind, interest)
    ),
    ...uniqueInterests.filter(
      (interest) => !programMatchesInterest(legacyProgram.kind, interest)
    ),
  ];
}

/** Selects the provably newer write and rejects equal conflicting timestamps. */
function getSelectionAuthority({
  canonicalSelection,
  legacySelection,
  preference,
  profile,
}: {
  canonicalSelection: ResolvedLearningSelection;
  legacySelection: ResolvedLearningSelection | null;
  preference: Doc<"learningPreferences">;
  profile: Doc<"learningProfiles">;
}) {
  if (!legacySelection) {
    const canonicalIsCurrent =
      preference.selectionUpdatedAt !== undefined &&
      preference.selectionUpdatedAt >= profile.updatedAt;
    return canonicalIsCurrent ? "canonical" : "unresolved";
  }

  if (
    canonicalSelection.interest === legacySelection.interest &&
    canonicalSelection.program.key === legacySelection.program.key &&
    preference.selectionUpdatedAt !== undefined
  ) {
    return "canonical";
  }

  if (preference.selectionUpdatedAt === undefined) {
    return "legacy";
  }

  if (preference.selectionUpdatedAt > profile.updatedAt) {
    return "canonical";
  }

  if (preference.selectionUpdatedAt < profile.updatedAt) {
    return "legacy";
  }

  return "unresolved";
}
