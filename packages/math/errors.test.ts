import { MathCasRequestError, MathCasResponseError } from "@repo/math/errors";
import { describe, expect, it } from "vitest";

describe("math errors", () => {
  it("keeps request failures tagged", () => {
    expect(
      new MathCasRequestError({
        message: "CAS failed.",
        status: 500,
      })
    ).toMatchObject({
      _tag: "MathCasRequestError",
      message: "CAS failed.",
      status: 500,
    });
  });

  it("keeps response failures tagged", () => {
    expect(
      new MathCasResponseError({
        message: "Invalid payload.",
      })
    ).toMatchObject({
      _tag: "MathCasResponseError",
      message: "Invalid payload.",
    });
  });
});
