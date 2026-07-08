import { ContentIO } from "@repo/contents/_lib/io/content";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import {
  findPublicRouteByPath,
  listPublicRoutes,
} from "@repo/contents/_types/route/projection";
import {
  PublicRoutePathSchema,
  PublicRouteSegmentSchema,
} from "@repo/contents/_types/route/segment";
import { Effect, Either, Option, Schema } from "effect";
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

  it("decodes branded public segments and paths at the route boundary", () => {
    const invalidSegment = Schema.decodeUnknownEither(PublicRouteSegmentSchema)(
      "Not A Segment"
    );
    const invalidPath = Schema.decodeUnknownEither(PublicRoutePathSchema)(
      "materi//matematika"
    );

    expect(Either.isLeft(invalidSegment)).toBe(true);
    expect(Either.isLeft(invalidPath)).toBe(true);
    if (Either.isLeft(invalidSegment)) {
      expect(String(invalidSegment.left)).toContain(
        "Invalid public route segment."
      );
    }
    if (Either.isLeft(invalidPath)) {
      expect(String(invalidPath.left)).toContain("Invalid public route path.");
    }
  });

  it("keeps old route identities and internal source paths out of public routes", () => {
    const invalidPaths = [
      "material/lesson/mathematics/integral/riemann-sum",
      "subject/matematika/integral/jumlahan-riemann",
      "try-out/indonesia/snbt/set-1/unknown-section",
      "ujian/snbt/pengetahuan-kuantitatif",
      "exams/snbt/quantitative-knowledge",
    ];

    for (const path of invalidPaths) {
      expect(
        Option.isNone(Effect.runSync(findPublicRouteByPath(path, "id")))
      ).toBe(true);
    }
  });

  it("uses scoped Effect projection when callers provide source overrides", () => {
    expect(
      Option.isSome(
        Effect.runSync(
          findPublicRouteByPath("materi/fisika/vektor/konsep-vektor", "id", {
            curricula: [],
          })
        )
      )
    ).toBe(true);

    expect(
      Option.isSome(
        Effect.runSync(
          findPublicRouteByPath("materi/fisika/vektor/konsep-vektor", "id", {
            curricula: [],
            domains: MATERIAL_ROUTE_DOMAINS,
          })
        )
      )
    ).toBe(true);

    expect(
      Option.isNone(
        Effect.runSync(
          findPublicRouteByPath("materi/fisika/vektor/konsep-vektor", "id", {
            curricula: [],
            materials: [],
          })
        )
      )
    ).toBe(true);
  });

  it("keeps dynamic slug maps outside the route projection aggregator", async () => {
    const source = await Effect.runPromise(
      ContentIO.readFileString(
        new URL("projection.ts", import.meta.url).pathname
      ).pipe(Effect.provide(ContentIO.Default))
    );
    const forbiddenTokens = [
      ["domain", "Slugs"].join(""),
      ["program", "Slugs"].join(""),
      ["??", "toPublicSlug"].join(" "),
      ["tryout", "2026"].join("-"),
    ];

    for (const token of forbiddenTokens) {
      expect(source).not.toContain(token);
    }
  });
});
