import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { describe, expect, it } from "vitest";

describe("Nakafa content reference fixtures", () => {
  it("rejects runtime section values outside the agent contract", () => {
    expect(() =>
      Reflect.apply(readNakafaContentRefFixture, undefined, [
        "en",
        "articles/politics/example",
        "unknown",
      ])
    ).toThrow("Invalid Nakafa content reference fixture");
  });
});
