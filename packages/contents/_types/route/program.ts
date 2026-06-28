import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import type { LearningProgramKey } from "@repo/contents/_types/program/schema";
import { MissingPublicSlugError } from "@repo/contents/_types/route/error";
import type { RouteInputs } from "@repo/contents/_types/route/input";
import { Effect } from "effect";

/** Finds a learning program row by stable key before route projection uses it. */
export function findProgram(
  programKey: LearningProgramKey,
  programs: RouteInputs["programs"] = LEARNING_PROGRAM_CATALOG
) {
  return Effect.gen(function* () {
    const program = programs.find((candidate) => candidate.key === programKey);

    if (!program) {
      return yield* Effect.fail(
        new MissingPublicSlugError({
          locale: "en",
          source: "program",
          value: programKey,
        })
      );
    }

    return program;
  });
}
