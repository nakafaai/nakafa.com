import { describe, expect, it } from "vitest";
import {
  getApplicationErrorCode,
  getApplicationErrorData,
  getApplicationErrorText,
  hasApplicationErrorCode,
} from "@/lib/errors";

describe("lib/errors", () => {
  it("reads structured transport error data", () => {
    const error = { data: { code: "SCHOOL_NOT_FOUND" } };

    expect(getApplicationErrorData(error)).toEqual({
      code: "SCHOOL_NOT_FOUND",
    });
    expect(getApplicationErrorCode(error)).toBe("SCHOOL_NOT_FOUND");
    expect(hasApplicationErrorCode(error, ["SCHOOL_NOT_FOUND"])).toBe(true);
    expect(hasApplicationErrorCode(error, ["CLASS_NOT_FOUND"])).toBe(false);
  });

  it("reads useful text from known error shapes", () => {
    expect(getApplicationErrorText({ data: "auth token missing" })).toBe(
      "auth token missing"
    );
    expect(
      getApplicationErrorText({
        data: { code: "UNAUTHENTICATED", message: "Auth failed" },
      })
    ).toBe("UNAUTHENTICATED");
    expect(getApplicationErrorText({ data: { message: "Auth failed" } })).toBe(
      "Auth failed"
    );
    expect(getApplicationErrorText(new Error("Runtime failed"))).toBe(
      "Runtime failed"
    );
  });

  it("returns nullish fallbacks for unknown shapes", () => {
    expect(getApplicationErrorData("failure")).toBeNull();
    expect(getApplicationErrorData({ data: null })).toBeNull();
    expect(getApplicationErrorCode({ data: "failure" })).toBeNull();
    expect(getApplicationErrorCode({ data: { code: 401 } })).toBeNull();
    expect(getApplicationErrorText("failure")).toBe("");
  });
});
