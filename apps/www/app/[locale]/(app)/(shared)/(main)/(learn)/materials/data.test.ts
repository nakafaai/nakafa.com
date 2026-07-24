// @vitest-environment node

import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { readStaticPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum/static";
import {
  type PublicContentRoute,
  PublicContentRouteSchema,
} from "@repo/contents/_types/route/schema";
import { Effect, Either, Option, Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listDomainMaterialStaticParams,
  listGenericMaterialStaticParams,
  readMaterialRendererDomain,
  readMaterialRoute,
  readMaterialRoutes,
  resolveMaterial,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/data";
import type { MaterialRouteParams } from "@/lib/content/material";

const CONTENT_STATIC_MODULE = "@repo/contents/_types/route/content/static";
const LEARNING_STATIC_MODULE = "@repo/contents/_types/route/learning/static";
const DATA_MODULE =
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/data";

/** Returns one real projected route or fails at the test boundary. */
function requireRoute(
  domain: RendererDomain,
  locale: ContentLocale,
  kind: PublicContentRoute["kind"] = "subject-lesson"
) {
  const route = readMaterialRoutes().find(
    (candidate) =>
      candidate.kind === kind &&
      candidate.locale === locale &&
      candidate.sourcePath.split("/")[2] === domain
  );
  if (!route) {
    throw new Error(`Expected one real ${locale} ${domain} ${kind} route.`);
  }

  return route;
}

/** Converts one real projected route to the Next material param shape. */
function toRouteParams(route: PublicContentRoute): MaterialRouteParams {
  const [, subject, topic, ...lesson] = route.publicPath.split("/");
  if (!(subject && topic)) {
    throw new Error("Expected a real route with subject and topic segments.");
  }

  return { lesson, locale: route.locale, subject, topic };
}

/** Loads a fresh data module behind caller-provided projected dependencies. */
function loadData(
  routes: readonly PublicContentRoute[],
  resolveRouteByPath?: () => unknown
) {
  vi.resetModules();
  vi.doMock(CONTENT_STATIC_MODULE, () => ({
    readStaticPublicContentRoutes: () => routes,
  }));
  if (resolveRouteByPath) {
    vi.doMock(LEARNING_STATIC_MODULE, () => ({
      readStaticPublicLearningIndex: () => ({ resolveRouteByPath }),
    }));
  } else {
    vi.doUnmock(LEARNING_STATIC_MODULE);
  }

  return import(DATA_MODULE);
}

afterEach(() => {
  vi.doUnmock(CONTENT_STATIC_MODULE);
  vi.doUnmock(LEARNING_STATIC_MODULE);
  vi.resetModules();
});

describe("material route data", () => {
  it("caches the real catalog and decodes its renderer ownership", () => {
    const first = readMaterialRoutes();
    const route = requireRoute("mathematics", "en");
    const invalid = Schema.decodeUnknownSync(PublicContentRouteSchema)({
      ...route,
      sourcePath: route.sourcePath.replace("/mathematics/", "/unknown/"),
    });

    expect(readMaterialRoutes()).toBe(first);
    expect(Effect.runSync(readMaterialRendererDomain(route))).toBe(
      "mathematics"
    );
    expect(
      Effect.runSync(readMaterialRendererDomain(invalid).pipe(Effect.flip))
    ).toMatchObject({
      _tag: "MaterialRouteError",
      reason: "renderer-domain",
      value: invalid.sourcePath,
    });
  });

  it("partitions every real locale through exactly one physical route", () => {
    const generic = Effect.runSync(listGenericMaterialStaticParams());
    const genericEn = Effect.runSync(listGenericMaterialStaticParams("en"));
    const chemistry = Effect.runSync(
      listDomainMaterialStaticParams("chemistry", "id")
    );
    const mathematics = Effect.runSync(
      listDomainMaterialStaticParams("mathematics", "en")
    );

    expect(generic.length).toBeGreaterThan(genericEn.length);
    expect(genericEn.length).toBeGreaterThan(0);
    expect(chemistry.length).toBeGreaterThan(0);
    expect(mathematics.length).toBeGreaterThan(0);
    expect(
      [...generic, ...chemistry, ...mathematics].every(
        ({ lesson, topic }) => lesson.length > 0 && topic.length > 0
      )
    ).toBe(true);
  });

  it("resolves real generic and fixed-domain lessons by localized params", () => {
    const biology = requireRoute("biology", "id");
    const chemistry = requireRoute("chemistry", "en");
    const mathematics = requireRoute("mathematics", "id");
    const resolved = [
      Effect.runSync(readMaterialRoute(toRouteParams(biology), "generic")),
      Effect.runSync(readMaterialRoute(toRouteParams(chemistry), "chemistry")),
      Effect.runSync(
        readMaterialRoute(toRouteParams(mathematics), "mathematics")
      ),
    ];

    expect(resolved.every(Option.isSome)).toBe(true);
    expect(
      resolved.map(Option.getOrUndefined).map((item) => item?.route)
    ).toEqual([biology, chemistry, mathematics]);
  });

  it("returns absence for incomplete, grouping, missing, and wrong routes", () => {
    const mathematics = requireRoute("mathematics", "en");
    const chemistry = requireRoute("chemistry", "en");
    const topic = requireRoute("biology", "en", "subject-topic");
    const topicParams = toRouteParams(topic);
    const missing = { ...toRouteParams(mathematics), topic: "missing" };
    const resolutions = [
      Effect.runSync(
        readMaterialRoute({ ...topicParams, subject: undefined }, "generic")
      ),
      Effect.runSync(
        readMaterialRoute(
          {
            locale: topicParams.locale,
            subject: topicParams.subject,
            topic: topicParams.topic,
          },
          "generic"
        )
      ),
      Effect.runSync(readMaterialRoute(missing, "mathematics")),
      Effect.runSync(readMaterialRoute(toRouteParams(mathematics), "generic")),
      Effect.runSync(readMaterialRoute(toRouteParams(chemistry), "generic")),
    ];

    expect(resolutions.every(Option.isNone)).toBe(true);
  });

  it("keeps invalid locale failures typed", () => {
    const lesson = requireRoute("physics", "en");
    const invalid = resolveMaterial(
      { ...toRouteParams(lesson), locale: "invalid" },
      "generic"
    );

    expect(
      Effect.runSync(
        listGenericMaterialStaticParams("invalid").pipe(Effect.flip)
      )
    ).toMatchObject({ reason: "locale", value: "invalid" });
    expect(Either.isLeft(invalid)).toBe(true);
    if (Either.isRight(invalid)) {
      throw new Error(
        "Expected pure material resolution to reject the locale."
      );
    }
    expect(invalid.left).toMatchObject({
      reason: "locale",
      value: "invalid",
    });
  });

  it("rejects malformed projected paths through the static-param boundary", async () => {
    const route = requireRoute("biology", "en");
    const malformed = Schema.decodeUnknownSync(PublicContentRouteSchema)({
      ...route,
      publicPath: "subjects",
    });
    const data = await loadData([malformed]);

    expect(
      Effect.runSync(data.listGenericMaterialStaticParams().pipe(Effect.flip))
    ).toMatchObject({ reason: "public-path", value: "subjects" });
  });

  it("fails closed for absent and mismatched fixed-domain projections", async () => {
    const chemistry = requireRoute("chemistry", "en");
    const mathematics = requireRoute("mathematics", "en");
    const emptyData = await loadData([]);
    const empty = Effect.runSync(
      emptyData.readMaterialRoute(toRouteParams(chemistry), "chemistry")
    );
    const mismatch = {
      ...chemistry,
      sourcePath: mathematics.sourcePath,
    };
    const mismatchData = await loadData([chemistry], () => mismatch);
    const wrongDomain = Effect.runSync(
      mismatchData.readMaterialRoute(toRouteParams(chemistry), "chemistry")
    );
    const curriculum = readStaticPublicCurriculumRoutes()[0];
    if (!curriculum) {
      throw new Error("Expected at least one real curriculum route.");
    }
    const otherData = await loadData([chemistry], () => curriculum);
    const wrongKind = Effect.runSync(
      otherData.readMaterialRoute(toRouteParams(chemistry), "chemistry")
    );

    expect([empty, wrongDomain, wrongKind]).toEqual([
      Option.none(),
      Option.none(),
      Option.none(),
    ]);
  });

  it("keeps pure fixed-domain projection failures typed", async () => {
    const chemistry = requireRoute("chemistry", "en");
    const malformed = Schema.decodeUnknownSync(PublicContentRouteSchema)({
      ...chemistry,
      publicPath: "subjects",
    });
    const malformedData = await loadData([malformed]);
    const malformedResult = malformedData.resolveMaterial(
      toRouteParams(chemistry),
      "chemistry"
    );
    const unknown = Schema.decodeUnknownSync(PublicContentRouteSchema)({
      ...chemistry,
      sourcePath: chemistry.sourcePath.replace("/chemistry/", "/unknown/"),
    });
    const catalogData = await loadData([unknown]);
    const catalogResult = catalogData.resolveMaterial(
      toRouteParams(chemistry),
      "chemistry"
    );
    const unknownData = await loadData([chemistry], () => unknown);
    const unknownResult = unknownData.resolveMaterial(
      toRouteParams(chemistry),
      "chemistry"
    );

    expect(Either.isLeft(malformedResult)).toBe(true);
    expect(Either.isLeft(catalogResult)).toBe(true);
    expect(Either.isLeft(unknownResult)).toBe(true);
    if (
      Either.isRight(malformedResult) ||
      Either.isRight(catalogResult) ||
      Either.isRight(unknownResult)
    ) {
      throw new Error("Expected pure fixed-domain projection failures.");
    }
    expect(malformedResult.left).toMatchObject({ reason: "public-path" });
    expect(catalogResult.left).toMatchObject({ reason: "renderer-domain" });
    expect(unknownResult.left).toMatchObject({ reason: "renderer-domain" });
  });
});
