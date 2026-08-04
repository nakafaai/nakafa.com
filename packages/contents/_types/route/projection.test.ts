import { listPublicRoutes } from "@repo/contents/_types/route/projection";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("public route projection", () => {
  it("aggregates routes from every public route surface", async () => {
    const routes = await Effect.runPromise(listPublicRoutes());
    const kinds = new Set<string>(routes.map((route) => route.kind));

    expect(kinds.has("article-category")).toBe(true);
    expect(kinds.has("subject-lesson")).toBe(true);
    expect(kinds.has("curriculum-context")).toBe(true);
    expect(kinds.has("assessment-context")).toBe(false);
    expect(kinds.has("tryout-set")).toBe(true);
  });

  it("omits the filesystem tryout surface when given no owned tryouts", async () => {
    const routes = await Effect.runPromise(listPublicRoutes({ tryouts: [] }));

    expect(routes.some((route) => route.kind.startsWith("tryout-"))).toBe(
      false
    );
  });
});
