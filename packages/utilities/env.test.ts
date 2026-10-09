import { describe, expect, it } from "@effect/vitest";
import { InvalidEnvironmentError, readEnvironment } from "@repo/utilities/env";
import { Result, Schema } from "effect";

const fields = {
  PORT: Schema.FiniteFromString,
  REGION: Schema.UndefinedOr(Schema.String),
  TOKEN: Schema.NonEmptyString,
};

describe("readEnvironment", () => {
  it("decodes each value with the Schema of its key", () => {
    expect(
      readEnvironment(fields, {
        PORT: "3000",
        REGION: undefined,
        TOKEN: "secret",
      })
    ).toEqual({ PORT: 3000, REGION: undefined, TOKEN: "secret" });
  });

  it("keeps an empty string as a set value", () => {
    expect(
      readEnvironment(fields, { PORT: "3000", REGION: "", TOKEN: "secret" })
        .REGION
    ).toBe("");
  });

  it("throws a typed error that names the invalid variable", () => {
    const failure = Result.try(() =>
      readEnvironment(fields, { PORT: "3000", REGION: undefined, TOKEN: "" })
    );

    expect(Result.isFailure(failure)).toBe(true);
    expect(Result.merge(failure)).toBeInstanceOf(InvalidEnvironmentError);
    expect(Result.merge(failure)).toMatchObject({
      message: expect.stringContaining("Invalid environment variables: "),
    });
    expect(Result.merge(failure)).toMatchObject({
      message: expect.stringContaining("TOKEN"),
    });
  });

  it("names a variable that is not set", () => {
    expect(() =>
      readEnvironment(fields, {
        PORT: undefined,
        REGION: undefined,
        TOKEN: "secret",
      })
    ).toThrow("PORT");
  });
});
