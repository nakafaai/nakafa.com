import { listPublicRoutes } from "@repo/contents/_types/route/projection";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("public route projection", () => {
  it("aggregates routes from every public route surface", () => {
    const routes = Effect.runSync(listPublicRoutes());
    const kinds = new Set<string>(routes.map((route) => route.kind));

    expect(kinds.has("subject-lesson")).toBe(true);
    expect(kinds.has("curriculum-context")).toBe(true);
    expect(kinds.has("assessment-context")).toBe(false);
    expect(kinds.has("tryout-set")).toBe(true);
  });
});
