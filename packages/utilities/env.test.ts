import { afterEach, describe, expect, expectTypeOf, it } from "@effect/vitest";
import { InvalidEnvironmentError, readEnvironment } from "@repo/utilities/env";
import { Result, Schema } from "effect";

const fields = {
  PORT: Schema.FiniteFromString,
  REGION: Schema.UndefinedOr(Schema.String),
  TOKEN: Schema.NonEmptyString,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("requires one value for every key", () => {
    expectTypeOf(readEnvironment<typeof fields>)
      .parameter(1)
      .toEqualTypeOf<{
        readonly PORT: string | undefined;
        readonly REGION: string | undefined;
        readonly TOKEN: string | undefined;
      }>();
  });

  it("keeps an empty string as a set value", () => {
    expect(
      readEnvironment(fields, { PORT: "3000", REGION: "", TOKEN: "secret" })
        .REGION
    ).toBe("");
  });

  it("names every invalid variable in one line, without its value", () => {
    const failure = Result.try(() =>
      readEnvironment(fields, {
        PORT: "not-a-number",
        REGION: undefined,
        TOKEN: "",
      })
    );

    expect(Result.merge(failure)).toBeInstanceOf(InvalidEnvironmentError);
    expect(Result.merge(failure)).toMatchObject({
      message:
        "Invalid environment variables: PORT: Expected a finite number; TOKEN: Expected a value with a length of at least 1",
    });
  });

  it("names a variable that is not set", () => {
    expect(() =>
      readEnvironment(fields, {
        PORT: undefined,
        REGION: undefined,
        TOKEN: "secret",
      })
    ).toThrow("PORT: Expected string");
  });

  it("rejects a server variable in the browser and keeps public ones", () => {
    vi.stubGlobal("window", {});

    expect(() =>
      readEnvironment(fields, {
        PORT: "3000",
        REGION: undefined,
        TOKEN: "secret",
      })
    ).toThrow(
      "Invalid environment variables: PORT, REGION, TOKEN: a server variable was read in the browser"
    );
    expect(
      readEnvironment(
        { NEXT_PUBLIC_ORIGIN: Schema.NonEmptyString },
        { NEXT_PUBLIC_ORIGIN: "https://nakafa.com" }
      )
    ).toEqual({ NEXT_PUBLIC_ORIGIN: "https://nakafa.com" });
  });
});
