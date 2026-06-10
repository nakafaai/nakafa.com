// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routeDataSource = readFileSync(new URL("data.ts", import.meta.url), {
  encoding: "utf8",
});

describe("getExerciseRouteData cache policy", () => {
  it("uses the tagged content runtime cache policy", () => {
    expect(routeDataSource).toContain("applyContentRuntimeCache()");
    expect(routeDataSource).not.toContain('cacheLife("max")');
  });
});
