import {
  canonicalizeLearningProgram,
  type LearningProgram,
  LearningProgramSchema,
} from "@nakafa/aksara-contracts/program/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  migrationFail,
  ProgramMigrationError,
  type programMigrationCountsValidator,
  resolveHistoricalProgramKey,
} from "@repo/backend/convex/learningPrograms/migrations/spec";
import type { Infer } from "convex/values";
import { Effect, Schema } from "effect";

const PROGRAM_LIMIT = 6;
const SOURCE_LIMIT = 100;

type ExpectedCounts = Infer<typeof programMigrationCountsValidator>;
type LegacyMapping = Readonly<{
  historicalKey: "id-kurikulum-merdeka" | "snbt-2026";
  programId: Doc<"learningPrograms">["_id"];
}>;

/** Strictly decodes one legacy catalog row reconstructed with its citations. */
function decodeLegacyProgram(
  program: Doc<"learningPrograms">,
  sources: readonly Doc<"learningProgramSources">[]
) {
  return Schema.decodeUnknown(LearningProgramSchema)(
    {
      defaultCoverageStatus: program.defaultCoverageStatus,
      displayOrder: program.displayOrder,
      iconKey: program.iconKey,
      key: program.key,
      kind: program.kind,
      navigation: program.navigation,
      provider: {
        homeCountry: program.providerHomeCountry,
        kind: program.providerKind,
        name: program.providerName,
      },
      recommendedCountry: program.recommendedCountry,
      sources: sources.map(
        ({ label, retrievedAt, reviewAfter, type, url }) => ({
          label,
          retrievedAt,
          reviewAfter,
          type,
          url,
        })
      ),
      translations: program.translations,
      version: {
        endsAt: program.versionEndsAt,
        label: program.versionLabel,
        startsAt: program.versionStartsAt,
      },
    },
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(
      () =>
        new ProgramMigrationError({
          code: "LEARNING_PROGRAM_MIGRATION_CATALOG",
          message: `Legacy program ${program.key} is invalid.`,
        })
    )
  );
}

/** Adds reviewed orphan identities without embedding deployment IDs in code. */
function addLegacyMappings(
  currentById: ReadonlyMap<string, LearningProgram>,
  signedByKey: ReadonlyMap<string, LearningProgram>,
  mappings: readonly LegacyMapping[]
) {
  return Effect.gen(function* () {
    const programsById = new Map(currentById);
    for (const mapping of mappings) {
      if (programsById.has(mapping.programId)) {
        return yield* migrationFail(
          "LEARNING_PROGRAM_MIGRATION_MAPPING",
          `Legacy mapping ${mapping.programId} duplicates a current program.`
        );
      }
      const key = resolveHistoricalProgramKey(mapping.historicalKey);
      const signed = signedByKey.get(key);
      if (!signed) {
        return yield* migrationFail(
          "LEARNING_PROGRAM_MIGRATION_MAPPING",
          `Historical identity ${mapping.historicalKey} has no signed target.`
        );
      }
      programsById.set(mapping.programId, signed);
    }
    return programsById;
  });
}

/** Loads and proves the exact legacy catalog against signed Aksara rows. */
export const loadProgramMappings = Effect.fn(
  "learningPrograms.loadProgramMappings"
)(function* (
  ctx: MutationCtx,
  expected: ExpectedCounts,
  signedPrograms: readonly LearningProgram[],
  legacyMappings: readonly LegacyMapping[]
) {
  if (
    expected.programs !== PROGRAM_LIMIT ||
    !Number.isSafeInteger(expected.sources) ||
    expected.sources < 0 ||
    expected.sources > SOURCE_LIMIT
  ) {
    return yield* migrationFail(
      "LEARNING_PROGRAM_MIGRATION_LIMIT",
      "Legacy program or source count exceeds its migration contract."
    );
  }
  const [programs, sources] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db.query("learningPrograms").take(PROGRAM_LIMIT + 1)
    ),
    Effect.promise(() =>
      ctx.db.query("learningProgramSources").take(SOURCE_LIMIT + 1)
    ),
  ]);
  if (
    programs.length !== expected.programs ||
    sources.length !== expected.sources
  ) {
    return yield* migrationFail(
      "LEARNING_PROGRAM_MIGRATION_COUNT",
      `Legacy catalog expected ${expected.programs}/${expected.sources} program/source rows but found ${programs.length}/${sources.length}.`
    );
  }

  const signedByKey = new Map(
    signedPrograms.map((program) => [program.key, program])
  );
  const currentById = new Map<string, LearningProgram>();
  for (const program of programs) {
    const programSources = sources.filter(
      (source) => source.programId === program._id
    );
    const decoded = yield* decodeLegacyProgram(program, programSources);
    const signed = signedByKey.get(decoded.key);
    if (
      !signed ||
      canonicalizeLearningProgram(decoded) !==
        canonicalizeLearningProgram(signed)
    ) {
      return yield* migrationFail(
        "LEARNING_PROGRAM_MIGRATION_CATALOG",
        `Legacy program ${program.key} differs from its signed Aksara row.`
      );
    }
    currentById.set(program._id, signed);
  }
  if (
    currentById.size !== signedByKey.size ||
    sources.some((source) => !currentById.has(source.programId))
  ) {
    return yield* migrationFail(
      "LEARNING_PROGRAM_MIGRATION_CATALOG",
      "Legacy program sources do not belong to the complete signed catalog."
    );
  }
  return yield* addLegacyMappings(currentById, signedByKey, legacyMappings);
});
