// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Result, Schema } from "effect";
import {
  EnvironmentValuesSchema,
  isPublicName,
  setValues,
} from "#www/deploy/environment";

describe("setValues", () => {
  it("skips an unset optional value, whether undefined or empty", () => {
    expect(
      setValues({
        OPENWEATHER_API_KEY: "",
        OTHER: undefined,
        SITE_URL: "https://nakafa.com",
      })
    ).toEqual({ SITE_URL: "https://nakafa.com" });
  });
});

describe("isPublicName", () => {
  it("keeps a VITE_ name public and every other name secret", () => {
    expect(isPublicName("VITE_CONVEX_URL")).toBe(true);
    expect(isPublicName("AKSARA_PUBLICATION_TOKEN")).toBe(false);
  });
});

describe("EnvironmentValuesSchema", () => {
  it("decodes an operator file of text values", () => {
    expect(
      Schema.decodeSync(EnvironmentValuesSchema)(
        '{"SITE_URL":"https://nakafa.com"}'
      )
    ).toEqual({ SITE_URL: "https://nakafa.com" });
  });

  it("refuses a value that is not text, without showing it", () => {
    const result = Schema.decodeResult(EnvironmentValuesSchema)('{"TOKEN":42}');

    expect(Result.isFailure(result)).toBe(true);
  });
});
