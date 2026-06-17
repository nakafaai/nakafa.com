import { LEARNING_PROGRAM_KEYS } from "@repo/contents/_types/program/catalog";
import { findProgram } from "@repo/contents/_types/route/program";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("public route program lookup", () => {
  it("finds catalog programs by stable key and fails when the source row is missing", () => {
    const program = Effect.runSync(findProgram(LEARNING_PROGRAM_KEYS.merdeka));
    const missing = Effect.runSyncExit(
      findProgram(LEARNING_PROGRAM_KEYS.merdeka, [])
    );

    expect(program.translations.id.publicSlug).toBe("merdeka");
    expect(Exit.isFailure(missing)).toBe(true);
  });
});
