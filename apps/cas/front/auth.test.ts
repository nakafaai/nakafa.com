import { describe, expect, it } from "@effect/vitest";
import { isAuthorized, sameSecret } from "@/front/auth";

describe("sameSecret", () => {
  it("accepts an equal secret", () => {
    expect(sameSecret("key-1", "key-1")).toBe(true);
  });

  it("refuses a different secret of the same length", () => {
    expect(sameSecret("key-1", "key-2")).toBe(false);
  });

  it("refuses a secret of another length", () => {
    expect(sameSecret("key-1", "key-10")).toBe(false);
  });
});

describe("isAuthorized", () => {
  it("accepts the bearer token of the configured key", () => {
    expect(isAuthorized("Bearer secret", "secret")).toBe(true);
  });

  it("refuses a request without an Authorization header", () => {
    expect(isAuthorized(null, "secret")).toBe(false);
  });

  it("refuses another key, and a key without the bearer scheme", () => {
    expect(isAuthorized("Bearer other", "secret")).toBe(false);
    expect(isAuthorized("secret", "secret")).toBe(false);
  });
});
