// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routeDataSource = readFileSync(new URL("data.ts", import.meta.url), {
  encoding: "utf8",
});

describe("getExerciseRouteData cache policy", () => {
  it("keeps Convex runtime exercise reads on a short cache profile", () => {
    expect(routeDataSource).toContain('cacheLife("seconds")');
    expect(routeDataSource).not.toContain('cacheLife("max")');
  });
});
