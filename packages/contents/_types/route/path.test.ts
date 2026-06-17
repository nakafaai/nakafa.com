import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import {
  comparePublicRouteOrder,
  decodeRouteDomains,
  getParentPath,
  getPublicRouteNamespace,
  makePath,
  readPathWithoutNamespace,
} from "@repo/contents/_types/route/path";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("public route path helpers", () => {
  it("decodes source-owned domain rows and localized namespace segments", () => {
    const domains = Effect.runSync(decodeRouteDomains(MATERIAL_ROUTE_DOMAINS));

    expect(domains.length).toBeGreaterThan(0);
    expect(Effect.runSync(getPublicRouteNamespace("subject", "id"))).toBe(
      "materi"
    );
  });

  it("fails with typed route source errors for invalid domain rows", () => {
    const exit = Effect.runSyncExit(
      decodeRouteDomains([
        {
          domain: "mathematics",
          kind: "lesson",
          routeSlugs: { en: "Mathematics", id: "matematika" },
        },
      ])
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("reads route hierarchy and deterministic ordering from decoded paths", () => {
    expect(getParentPath("materi/matematika/integral/jumlahan-riemann")).toBe(
      "materi/matematika/integral"
    );
    expect(readPathWithoutNamespace("materi/matematika/integral")).toBe(
      "matematika/integral"
    );
    expect(
      comparePublicRouteOrder(
        { order: 2, publicPath: Effect.runSync(makePath(["materi", "b"])) },
        { order: 1, publicPath: Effect.runSync(makePath(["materi", "a"])) }
      )
    ).toBeGreaterThan(0);
    expect(
      comparePublicRouteOrder(
        { order: 1, publicPath: Effect.runSync(makePath(["materi", "b"])) },
        { order: 1, publicPath: Effect.runSync(makePath(["materi", "a"])) }
      )
    ).toBeGreaterThan(0);
  });
});
