// @vitest-environment node

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  type LocalPreviewManifest,
  LocalPreviewManifestSchema,
} from "@nakafa/aksara-contracts/preview/spec";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { Effect, Option, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPreviewSnapshot } from "@/lib/content/preview/manifest";
import {
  type MaterialPreviewRouteInput,
  matchesInternalPreviewRoute,
  matchesMaterialPreviewRoute,
  matchesPreviewPathname,
  matchesPreviewRoute,
  parseMaterialPreviewStaticParams,
  readArticlePreviewStaticParams,
  readMaterialPreviewStaticParams,
  readPreviewStaticLocaleParams,
} from "@/lib/content/preview/route";
import {
  makePendingManifest,
  previewConfig,
  previewDocument,
  previewRoute,
} from "@/test/content-preview";
import {
  articlePendingManifest,
  germanArticlePendingManifest,
} from "@/test/preview-article";

vi.mock("@/lib/content/preview/manifest", () => ({
  readPreviewSnapshot: vi.fn(),
}));

const snapshotMock = vi.mocked(readPreviewSnapshot);
const materialInput = {
  params: {
    lesson: ["function-concept"],
    locale: "en",
    subject: "mathematics",
    topic: "function-composition-inverse-function",
  },
} satisfies MaterialPreviewRouteInput;

/** Builds a strictly decoded pending manifest for route-matching cases. */
function pendingRoute({
  rendererDomain = "mathematics",
  publicPath = previewRoute.publicPath,
}: {
  readonly publicPath?: string;
  readonly rendererDomain?: RendererDomain;
} = {}) {
  const base = makePendingManifest();

  const manifest = Schema.decodeUnknownSync(LocalPreviewManifestSchema)({
    ...base,
    document: {
      ...previewDocument,
      rendererDomain,
      route: { ...previewDocument.route, publicPath },
    },
  });
  if (manifest.document.family !== "material") {
    throw new Error("Expected a material preview manifest.");
  }

  return manifest;
}

const materialMismatchCases: readonly [
  string,
  LocalPreviewManifest,
  Partial<MaterialPreviewRouteInput["params"]>,
][] = [
  ["locale", pendingRoute(), { locale: "id" }],
  ["topic", pendingRoute(), { topic: "other" }],
  ["lesson count", pendingRoute(), { lesson: [] }],
  ["lesson value", pendingRoute(), { lesson: ["other"] }],
  ["subject", pendingRoute(), { subject: "physics" }],
];

/** Runs one public preview route decision. */
function matchPublic(publicPath: string = previewRoute.publicPath) {
  return Effect.runPromise(
    matchesPreviewRoute({ appLocale: previewRoute.appLocale, publicPath })
  );
}

/** Runs one next-intl internal rewrite decision. */
function matchInternal(
  pathname = "/en/materials/mathematics/function-composition-inverse-function/function-concept",
  localeHint: string | null = "en"
) {
  return Effect.runPromise(
    matchesInternalPreviewRoute({ localeHint, pathname })
  );
}

beforeEach(() => {
  snapshotMock.mockReset();
  snapshotMock.mockReturnValue(
    Effect.succeed(
      Option.some({ config: previewConfig, manifest: makePendingManifest() })
    )
  );
});

describe("local preview route matching", () => {
  it("prerenders only the selected preview locale", async () => {
    await expect(
      Effect.runPromise(readPreviewStaticLocaleParams())
    ).resolves.toEqual([{ locale: "en" }]);

    snapshotMock.mockReturnValueOnce(Effect.succeed(Option.none()));
    await expect(
      Effect.runPromise(readPreviewStaticLocaleParams().pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "manifest",
    });
  });

  it("leaves every route unchanged when preview is disabled", async () => {
    snapshotMock.mockReturnValueOnce(Effect.succeed(Option.none()));

    await expect(matchPublic()).resolves.toBe(false);
  });

  it("matches only the exact selected locale and public path", async () => {
    await expect(matchPublic()).resolves.toBe(true);
    await expect(matchPublic(`${previewRoute.publicPath}-other`)).resolves.toBe(
      false
    );
    await expect(
      Effect.runPromise(
        matchesPreviewRoute({
          appLocale: AppLocaleSchema.make("id"),
          publicPath: previewRoute.publicPath,
        })
      )
    ).resolves.toBe(false);
  });

  it("matches only the selected localized public pathname", async () => {
    await expect(
      Effect.runPromise(
        matchesPreviewPathname(`/en/${previewRoute.publicPath}`)
      )
    ).resolves.toBe(true);
    await expect(
      Effect.runPromise(matchesPreviewPathname("/en/school/onboarding/create"))
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(matchesPreviewPathname("/de"))
    ).resolves.toBe(false);
  });

  it("maps the exact next-intl internal material rewrite", async () => {
    await expect(matchInternal()).resolves.toBe(true);
  });

  it("matches the mathematics route without consulting a static catalog", () => {
    expect(matchesMaterialPreviewRoute(pendingRoute(), materialInput)).toBe(
      true
    );
  });

  it("projects the selected material route into nonempty static params", async () => {
    await expect(
      Effect.runPromise(
        readMaterialPreviewStaticParams(AppLocaleSchema.make("en"))
      )
    ).resolves.toEqual({
      lesson: ["function-concept"],
      subject: "mathematics",
      topic: "function-composition-inverse-function",
    });
  });

  it("projects the selected article route into localized static params", async () => {
    snapshotMock.mockReturnValueOnce(
      Effect.succeed(
        Option.some({
          config: previewConfig,
          manifest: germanArticlePendingManifest,
        })
      )
    );

    await expect(
      Effect.runPromise(
        readArticlePreviewStaticParams(AppLocaleSchema.make("de"))
      )
    ).resolves.toEqual({
      category: "politik",
      slug: "politische-dynastien-und-asiatische-werte",
    });
  });

  it("rejects malformed material preview paths", async () => {
    await expect(
      Effect.runPromise(
        parseMaterialPreviewStaticParams({
          appLocale: AppLocaleSchema.make("en"),
          publicPath: "articles/mathematics/functions/concept",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "projection",
    });

    await expect(
      Effect.runPromise(
        parseMaterialPreviewStaticParams({
          appLocale: AppLocaleSchema.make("en"),
          publicPath: "subjects/mathematics/functions",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "projection",
    });
  });

  it("rejects a missing or mismatched material preview projection", async () => {
    snapshotMock.mockReturnValueOnce(Effect.succeed(Option.none()));
    await expect(
      Effect.runPromise(
        readMaterialPreviewStaticParams(AppLocaleSchema.make("en")).pipe(
          Effect.flip
        )
      )
    ).resolves.toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "manifest",
    });

    snapshotMock.mockReturnValueOnce(
      Effect.succeed(
        Option.some({ config: previewConfig, manifest: articlePendingManifest })
      )
    );
    await expect(
      Effect.runPromise(
        readMaterialPreviewStaticParams(AppLocaleSchema.make("en")).pipe(
          Effect.flip
        )
      )
    ).resolves.toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "projection",
    });
  });

  it("rejects a missing or mismatched article preview projection", async () => {
    snapshotMock.mockReturnValueOnce(Effect.succeed(Option.none()));
    await expect(
      Effect.runPromise(
        readArticlePreviewStaticParams(AppLocaleSchema.make("en")).pipe(
          Effect.flip
        )
      )
    ).resolves.toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "manifest",
    });

    await expect(
      Effect.runPromise(
        readArticlePreviewStaticParams(AppLocaleSchema.make("en")).pipe(
          Effect.flip
        )
      )
    ).resolves.toMatchObject({
      _tag: "PreviewIntegrityError",
      check: "projection",
    });
  });

  it("does not claim an article preview route", () => {
    expect(
      matchesMaterialPreviewRoute(articlePendingManifest, materialInput)
    ).toBe(false);
  });

  it("keeps selected renderer mismatches visible to the execution boundary", () => {
    expect(
      matchesMaterialPreviewRoute(
        pendingRoute({ rendererDomain: "physics" }),
        materialInput
      )
    ).toBe(true);
  });

  it("rejects a lesson route when the request omits its lesson segments", () => {
    expect(
      matchesMaterialPreviewRoute(pendingRoute(), {
        params: {
          locale: materialInput.params.locale,
          subject: materialInput.params.subject,
          topic: materialInput.params.topic,
        },
      })
    ).toBe(false);
  });

  it.each(materialMismatchCases)(
    "rejects a mismatched material %s",
    (_label, manifest, change) => {
      expect(
        matchesMaterialPreviewRoute(manifest, {
          params: { ...materialInput.params, ...change },
        })
      ).toBe(false);
    }
  );

  it.each([
    ["missing locale hint", null, "/en/materials/math/topic/lesson"],
    ["unsupported locale", "de", "/de/materials/math/topic/lesson"],
    ["public namespace", "en", "/en/subjects/math/topic/lesson"],
    ["short route", "en", "/en/materials/math/topic"],
    ["other document", "en", "/en/materials/math/topic/lesson"],
  ])("rejects an invalid %s", async (_label, localeHint, pathname) => {
    await expect(matchInternal(pathname, localeHint)).resolves.toBe(false);
  });
});
