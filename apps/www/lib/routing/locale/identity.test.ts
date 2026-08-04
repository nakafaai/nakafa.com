// @vitest-environment node
import { listPublicRoutes } from "@repo/contents/_types/route/projection";
import { readStaticPublicTryoutRoutes } from "@repo/contents/_types/route/tryout/static";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { isSamePublicRouteIdentity } from "@/lib/routing/locale/identity";

describe("isSamePublicRouteIdentity", () => {
  it("matches every try-out hierarchy level by its source identity", () => {
    const routes = readStaticPublicTryoutRoutes();
    const kinds = [
      "tryout-country",
      "tryout-exam",
      "tryout-track",
      "tryout-set",
      "tryout-section",
    ] as const;

    for (const kind of kinds) {
      const route = routes.find((candidate) => candidate.kind === kind);

      expect(route).toBeDefined();
      if (!route) {
        continue;
      }

      expect(isSamePublicRouteIdentity(route, route)).toBe(true);
    }
  });

  it("rejects different route kinds", () => {
    const routes = readStaticPublicTryoutRoutes();
    const country = routes.find(
      (candidate) => candidate.kind === "tryout-country"
    );
    const exam = routes.find((candidate) => candidate.kind === "tryout-exam");

    expect(country).toBeDefined();
    expect(exam).toBeDefined();
    if (!(country && exam)) {
      return;
    }

    expect(isSamePublicRouteIdentity(country, exam)).toBe(false);
  });

  it("matches curriculum and authored content through their stable keys", async () => {
    const routes = await Effect.runPromise(listPublicRoutes());
    const curriculum = routes.find(
      (candidate) => candidate.kind === "curriculum-context"
    );
    const lesson = routes.find(
      (candidate) => candidate.kind === "subject-lesson"
    );

    expect(curriculum).toBeDefined();
    expect(lesson).toBeDefined();
    if (!(curriculum && lesson)) {
      return;
    }

    expect(isSamePublicRouteIdentity(curriculum, curriculum)).toBe(true);
    expect(isSamePublicRouteIdentity(lesson, lesson)).toBe(true);
  });
});
