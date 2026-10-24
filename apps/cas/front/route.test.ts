import { describe, expect, it } from "@effect/vitest";
import { routeOf } from "@/front/route";

describe("routeOf", () => {
  it("answers the health path only for GET", () => {
    expect(routeOf("GET", "/health")).toBe("health");
    expect(routeOf("POST", "/health")).toBe("methodNotAllowed");
  });

  it("forwards the math path only for POST", () => {
    expect(routeOf("POST", "/api/math")).toBe("math");
    expect(routeOf("GET", "/api/math")).toBe("methodNotAllowed");
  });

  it("answers every other path as not found", () => {
    expect(routeOf("GET", "/")).toBe("notFound");
    expect(routeOf("POST", "/api/math/extra")).toBe("notFound");
  });
});
