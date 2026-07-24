// @vitest-environment node

import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { readMaterialRoutes } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/data";
import {
  readMaterialHeaderLink,
  readMaterialPagePagination,
  requireParentMaterialRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/navigation";

/** Returns the real material route used to verify contextual navigation. */
function requireContextRoute() {
  const route = readMaterialRoutes().find(
    (candidate) =>
      candidate.locale === "id" &&
      candidate.publicPath ===
        "materi/matematika/eksponen-dan-logaritma/konsep-eksponen"
  );
  if (!route) {
    throw new Error("Expected the real Indonesian exponential concept route.");
  }

  return route;
}

describe("material navigation", () => {
  it("preserves parent, header, and pagination context", () => {
    const route = requireContextRoute();
    const context = {
      nodeKey: "class-10-mathematics-exponential-logarithm",
      programKey: "merdeka",
    };
    const header = readMaterialHeaderLink(route, context);
    const direct = readMaterialPagePagination(route, undefined);
    const stale = readMaterialPagePagination(route, {
      nodeKey: "class-10-biology-virus-role",
      programKey: "merdeka",
    });
    const contextual = readMaterialPagePagination(route, context);

    expect(Effect.runSync(requireParentMaterialRoute(route)).kind).toBe(
      "subject-topic"
    );
    expect(header?.href).toContain("/id/kurikulum/merdeka/");
    expect(readMaterialHeaderLink(route, undefined)).toBeUndefined();
    expect(stale).toEqual(direct);
    expect([contextual.prev.href, contextual.next.href].join(" ")).toContain(
      "ctx=merdeka~class-10-mathematics-exponential-logarithm"
    );
  });

  it("keeps missing parent failures typed", () => {
    const topic = readMaterialRoutes().find(
      (candidate) =>
        candidate.kind === "subject-topic" &&
        candidate.locale === "en" &&
        candidate.sourcePath.split("/")[2] === "physics"
    );
    if (!topic) {
      throw new Error("Expected one real English physics topic route.");
    }

    expect(
      Effect.runSync(requireParentMaterialRoute(topic).pipe(Effect.flip))
    ).toMatchObject({ reason: "parent-route", value: topic.publicPath });
  });
});
