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
      argv: ["taxonomy", "-p-hfoo"],
      expected: ["taxonomy", "--pretty=true", "--", "-h", "-f", "-o", "-o"],
    },
    {
      argv: ["taxonomy", "-p-hfoo=bar"],
      expected: [
        "taxonomy",
        "--pretty=true",
        "--",
        "-h",
        "-f",
        "-o",
        "-o",
        "-=",
        "-b",
        "-a",
        "-r",
      ],
    },
    {
      argv: ["taxonomy", "-p--h"],
      expected: ["taxonomy", "--pretty=true", "--", "--", "-h"],
    },
    {
      argv: ["taxonomy", "-p-"],
      expected: ["taxonomy", "--pretty=true", "--"],
    },
    {
      argv: ["taxonomy", "-ph-foo"],
      expected: ["taxonomy", "--pretty=true", "--help", "--", "-f", "-o", "-o"],
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
      argv: ["-x", "taxonomy"],
      expected: ["-x", "taxonomy"],
    },
    { argv: ["-", "taxonomy"], expected: ["-", "taxonomy"] },
    { argv: ["other", "taxonomy"], expected: ["other", "taxonomy"] },
    { argv: ["--pretty"], expected: ["--pretty=true"] },
    { argv: ["--locale", "id"], expected: ["--help"] },
    { argv: ["--locale", "id", "--"], expected: ["--help"] },
    { argv: ["--locale", "taxonomy"], expected: ["--help"] },
    { argv: ["--locale=id"], expected: ["--help"] },
    { argv: ["--limit", "5"], expected: ["--help"] },
    { argv: ["--tafsir"], expected: ["--help"] },
    { argv: ["--locale"], expected: ["--locale"] },
    {
      argv: ["--locale", "--", "taxonomy"],
      expected: ["--locale", "--", "taxonomy"],
    },
    { argv: ["--api-base"], expected: ["--api-base"] },
    {
      argv: ["--locale", "id", "--version"],
      expected: ["--version"],
    },
  ])("normalizes $argv", ({ argv, expected }) =>
    Effect.gen(function* () {
      expect(yield* normalizeArgv(argv)).toEqual(expected);
    })
  );

  it.effect.each([
    { argv: ["--pretty=false"], message: "does not accept a value" },
    { argv: ["--no-pretty=false"], message: "does not accept a value" },
    { argv: ["-p=true"], message: "does not accept a value" },
    { argv: ["-hv=false"], message: "does not accept a value" },
    {
      argv: ["taxonomy", "--locale", "--help", "id"],
      message: "requires a value",
    },
    {
      argv: ["taxonomy", "--locale", "--pretty", "id"],
      message: "requires a value",
    },
    { argv: ["--locale", "--pretty"], message: "requires a value" },
    {
      argv: ["taxonomy", "--locale", "-h", "id"],
      message: "requires a value",
    },
  ])("rejects invalid flag values $argv", ({ argv, message }) =>
    Effect.gen(function* () {
      const result = yield* normalizeArgv(argv).pipe(Effect.result);

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure).toBeInstanceOf(InvocationError);
        expect(result.failure.message).toContain(message);
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
    expect(
      Option.getOrUndefined(readActionValidation(["taxonomy", "-xhv"]))
    ).toEqual(["taxonomy", "-x"]);
    expect(
      Option.getOrUndefined(readActionValidation(["taxonomy", "-xh=value"]))
    ).toEqual(["taxonomy", "-x=value"]);
    expect(
      Option.getOrUndefined(readActionValidation(["taxonomy", "-h-foo"]))
    ).toEqual(["taxonomy"]);
    expect(
      Option.getOrUndefined(readActionValidation(["taxonomy", "-xh-foo"]))
    ).toEqual(["taxonomy", "-x"]);
    expect(Option.getOrUndefined(readActionValidation(["-h"]))).toEqual([]);
    expect(Option.isNone(readActionValidation(["-x"]))).toBe(true);
  });
});
