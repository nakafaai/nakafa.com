import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, Result } from "effect";
import { normalizeArgv, readActionValidation } from "#cli/command/argv";
import { InvocationError } from "#cli/error";

describe("Nakafa CLI arguments", () => {
  it.effect.each([
    {
      argv: ["--locale", "id", "taxonomy"],
      expected: ["taxonomy", "--locale", "id"],
    },
    {
      argv: ["--limit", "5", "search", "algebra"],
      expected: ["search", "--limit", "5", "algebra"],
    },
    {
      argv: ["--locale=id", "taxonomy"],
      expected: ["taxonomy", "--locale=id"],
    },
    {
      argv: ["--pretty", "--", "taxonomy"],
      expected: ["taxonomy", "--pretty=true", "--"],
    },
    {
      argv: ["--", "search", "linear", "algebra"],
      expected: ["search", "--", "linear", "algebra"],
    },
    {
      argv: ["quran", "--no-tafsir", "1"],
      expected: ["quran", "--tafsir=false", "1"],
    },
    {
      argv: ["search", "--no-pretty", "true"],
      expected: ["search", "--pretty=false", "true"],
    },
    {
      argv: ["-phv", "taxonomy"],
      expected: ["taxonomy", "--pretty=true", "--help", "--version"],
    },
    {
      argv: ["--help", "--no-help", "taxonomy"],
      expected: ["taxonomy"],
    },
    {
      argv: ["--no-version", "--version", "taxonomy"],
      expected: ["taxonomy", "--version"],
    },
    {
      argv: ["--bogus", "--", "taxonomy"],
      expected: ["--bogus", "--", "taxonomy"],
    },
    {
      argv: ["--help", "--", "--"],
      expected: ["--help", "--", "--"],
    },
    {
      argv: ["--no-locale", "taxonomy"],
      expected: ["--no-locale", "taxonomy"],
    },
    {
      argv: ["--locale", "--", "taxonomy"],
      expected: ["--locale", "--", "taxonomy"],
    },
    {
      argv: ["-x", "taxonomy"],
      expected: ["-x", "taxonomy"],
    },
    { argv: ["-", "taxonomy"], expected: ["-", "taxonomy"] },
    { argv: ["other", "taxonomy"], expected: ["other", "taxonomy"] },
    { argv: ["--pretty"], expected: ["--pretty=true"] },
  ])("normalizes $argv", ({ argv, expected }) =>
    Effect.gen(function* () {
      expect(yield* normalizeArgv(argv)).toEqual(expected);
    })
  );

  it.effect.each([
    ["--pretty=false"],
    ["--no-pretty=false"],
    ["-p=true"],
    ["-hv=false"],
  ])("rejects explicit presence value %j", (argv) =>
    Effect.gen(function* () {
      const result = yield* normalizeArgv(argv).pipe(Effect.result);

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(InvocationError);
        expect(result.failure.message).toContain("does not accept a value");
      }
    })
  );

  it("selects only pre-separator actions for dry validation", () => {
    expect(
      Option.getOrUndefined(
        readActionValidation([
          "taxonomy",
          "--help",
          "--version",
          "--",
          "--help",
        ])
      )
    ).toEqual(["taxonomy", "--", "--help"]);
    expect(Option.isNone(readActionValidation(["taxonomy"]))).toBe(true);
    expect(
      Option.isNone(readActionValidation(["search", "--", "--help"]))
    ).toBe(true);
    expect(
      Option.getOrUndefined(readActionValidation(["--help", "--", "--"]))
    ).toEqual(["--", "--"]);
  });
});
