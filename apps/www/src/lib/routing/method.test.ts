// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { methodNotAllowed } from "@/lib/routing/method";

describe("method not allowed", () => {
  it("answers 405 with an empty body and the methods the route serves", () => {
    const response = methodNotAllowed("GET, HEAD")();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
    expect(response.body).toBeNull();
  });
});
