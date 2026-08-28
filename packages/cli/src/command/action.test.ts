import { expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  omitActionValidationFlag,
  readActionValidation,
} from "#cli/command/action";

it("selects only pre-separator actions for dry validation", () => {
  expect(
    Option.getOrUndefined(
      readActionValidation(["taxonomy", "--help", "--version", "--", "--help"])
    )
  ).toEqual(["taxonomy", "--", "--help"]);
  expect(Option.isNone(readActionValidation(["taxonomy"]))).toBe(true);
  expect(Option.isNone(readActionValidation(["search", "--", "--help"]))).toBe(
    true
  );
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
  expect(
    Option.isNone(
      readActionValidation(["taxonomy", "-x", "--", "-h", "-f", "-o", "-o"])
    )
  ).toBe(true);
  expect(Option.getOrUndefined(readActionValidation(["-h"]))).toEqual([]);
  expect(Option.isNone(readActionValidation(["-x"]))).toBe(true);
});

it("omits only complete recognized command flags for action validation", () => {
  expect(
    Option.getOrUndefined(
      omitActionValidationFlag(["taxonomy", "--limit", "5"], "--limit")
    )
  ).toEqual(["taxonomy"]);
  expect(
    Option.getOrUndefined(
      omitActionValidationFlag(["mcp", "--locale=en"], "--locale")
    )
  ).toEqual(["mcp"]);
  expect(
    Option.getOrUndefined(
      omitActionValidationFlag(["taxonomy", "--tafsir"], "--tafsir")
    )
  ).toEqual(["taxonomy"]);
  expect(
    Option.isNone(omitActionValidationFlag(["taxonomy", "--limit"], "--limit"))
  ).toBe(true);
  expect(Option.isNone(omitActionValidationFlag(["taxonomy"], "--limit"))).toBe(
    true
  );
  expect(
    Option.isNone(omitActionValidationFlag(["taxonomy", "--bogus"], "--bogus"))
  ).toBe(true);
});
