// @vitest-environment node
import { listPublicRoutes } from "@repo/contents/_types/route/projection";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { isSamePublicRouteIdentity } from "@/lib/routing/locale/identity";

describe("isSamePublicRouteIdentity", () => {
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
