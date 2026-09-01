// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  type LocalPreviewManifest,
  LocalPreviewManifestSchema,
} from "@nakafa/aksara-contracts/preview/spec";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { Data, Effect, Option, Schema } from "effect";
import { PreviewIntegrityError } from "@/lib/content/preview/errors";
import {
  readPreviewManifestForPrerender,
  readPreviewSnapshot,
} from "@/lib/content/preview/manifest";
import {
  type MaterialPreviewRouteInput,
  matchesInternalPreviewRoute,
  matchesMaterialPreviewRoute,
  matchesPreviewPathname,
  matchesPreviewRoute,
  parseMaterialPreviewStaticParams,
  readArticlePreviewStaticParams,
  readMaterialPreviewStaticParams,
  readPagePreviewStaticParams,
  readPreviewStaticLocaleParams,
} from "@/lib/content/preview/route";
import { testPagePendingManifest } from "@/test/content-page";
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
  readPreviewManifestForPrerender: vi.fn(),
  readPreviewSnapshot: vi.fn(),
}));

const prerenderManifestMock = vi.mocked(readPreviewManifestForPrerender);
const snapshotMock = vi.mocked(readPreviewSnapshot);
const materialInput = {
  params: {
    lesson: ["function-concept"],
    locale: "en",
    subject: "mathematics",
    topic: "function-composition-inverse-function",
  },
} satisfies MaterialPreviewRouteInput;

class UnexpectedPreviewPromiseError extends Data.TaggedError(
  "UnexpectedPreviewPromiseError"
)<{ readonly cause: unknown }> {}

/** Adapts the intentional Next prerender Promise seam without erasing failures. */
function fromPreviewPromise<A>(evaluate: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) =>
      cause instanceof PreviewIntegrityError
        ? cause
        : new UnexpectedPreviewPromiseError({ cause }),
    try: evaluate,
  }).pipe(
    Effect.catchTag("UnexpectedPreviewPromiseError", ({ cause }) =>
      Effect.die(cause)
    )
  );
}

/** Builds a strictly decoded pending manifest for route-matching cases. */
function pendingRoute({
  rendererDomain = "mathematics",
  publicPath = previewRoute.publicPath,
}: {
  readonly publicPath?: string;
  readonly rendererDomain?: RendererDomain;
} = {}) {
  const base = makePendingManifest();

  const manifest = Schema.decodeSync(LocalPreviewManifestSchema)({
    ...base,
    document: {
      ...previewDocument,
      rendererDomain,
      route: { ...previewDocument.route, publicPath },
    },
  });
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
  return matchesPreviewRoute({ appLocale: previewRoute.appLocale, publicPath });
}

/** Runs one next-intl internal rewrite decision. */
function matchInternal(
  pathname = "/en/materials/mathematics/function-composition-inverse-function/function-concept",
  localeHint: string | null = "en"
) {
  return matchesInternalPreviewRoute({ localeHint, pathname });
}

beforeEach(() => {
  prerenderManifestMock.mockReset();
  prerenderManifestMock.mockResolvedValue(makePendingManifest());
  snapshotMock.mockReset();
  snapshotMock.mockReturnValue(
    Effect.succeed(
      Option.some({ config: previewConfig, manifest: makePendingManifest() })
    )
  );
});

describe("local preview route matching", () => {
  it.effect("prerenders only the selected preview locale", () =>
    Effect.gen(function* () {
      expect(yield* fromPreviewPromise(readPreviewStaticLocaleParams)).toEqual([
        { locale: "en" },
      ]);

      prerenderManifestMock.mockRejectedValueOnce(
        new PreviewIntegrityError({ check: "manifest" })
      );
      expect(
        yield* fromPreviewPromise(readPreviewStaticLocaleParams).pipe(
          Effect.flip
        )
      ).toMatchObject({
        _tag: "PreviewIntegrityError",
        check: "manifest",
      });
    })
  );

  it.effect("leaves every route unchanged when preview is disabled", () =>
    Effect.gen(function* () {
      snapshotMock.mockReturnValueOnce(Effect.succeed(Option.none()));

      expect(yield* matchPublic()).toBe(false);
    })
  );

  it.effect("matches only the exact selected locale and public path", () =>
    Effect.gen(function* () {
      expect(yield* matchPublic()).toBe(true);
      expect(yield* matchPublic(`${previewRoute.publicPath}-other`)).toBe(
        false
      );
      expect(
        yield* matchesPreviewRoute({
          appLocale: AppLocaleSchema.make("id"),
          publicPath: previewRoute.publicPath,
        })
      ).toBe(false);
    })
  );

  it.effect("matches only the selected localized public pathname", () =>
    Effect.gen(function* () {
      expect(
        yield* matchesPreviewPathname(`/en/${previewRoute.publicPath}`)
      ).toBe(true);
      expect(
        yield* matchesPreviewPathname("/en/school/onboarding/create")
      ).toBe(false);
      expect(yield* matchesPreviewPathname("/de")).toBe(false);
    })
  );

  it.effect("maps the exact next-intl internal material rewrite", () =>
    Effect.gen(function* () {
      expect(yield* matchInternal()).toBe(true);
    })
  );

  it("matches the mathematics route without consulting a static catalog", () => {
    expect(matchesMaterialPreviewRoute(pendingRoute(), materialInput)).toBe(
      true
    );
  });

  it.effect(
    "projects the selected material route into nonempty static params",
    () =>
      Effect.gen(function* () {
        expect(
          yield* fromPreviewPromise(() =>
            readMaterialPreviewStaticParams(AppLocaleSchema.make("en"))
          )
        ).toEqual({
          lesson: ["function-concept"],
          subject: "mathematics",
          topic: "function-composition-inverse-function",
        });
      })
  );

  it.effect(
    "projects the selected article route into localized static params",
    () =>
      Effect.gen(function* () {
        prerenderManifestMock.mockResolvedValueOnce(
          germanArticlePendingManifest
        );

        expect(
          yield* fromPreviewPromise(() =>
            readArticlePreviewStaticParams(AppLocaleSchema.make("de"))
          )
        ).toEqual({
          category: "politik",
          slug: "politische-dynastien-und-asiatische-werte",
        });
      })
  );

  it.effect(
    "projects the selected Page route into catch-all static params",
    () =>
      Effect.gen(function* () {
        prerenderManifestMock.mockResolvedValueOnce(testPagePendingManifest);

        expect(
          yield* fromPreviewPromise(() =>
            readPagePreviewStaticParams(AppLocaleSchema.make("en"))
          )
        ).toEqual({ page: ["terms-of-service"] });
      })
  );

  it.effect("rejects malformed material preview paths", () =>
    Effect.gen(function* () {
      expect(
        yield* parseMaterialPreviewStaticParams({
          appLocale: AppLocaleSchema.make("en"),
          publicPath: previewRoute.publicPath,
        })
      ).toEqual({
        lesson: ["function-concept"],
        subject: "mathematics",
        topic: "function-composition-inverse-function",
      });

      expect(
        yield* parseMaterialPreviewStaticParams({
          appLocale: AppLocaleSchema.make("en"),
          publicPath: "articles/mathematics/functions/concept",
        }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PreviewIntegrityError",
        check: "projection",
      });

      expect(
        yield* parseMaterialPreviewStaticParams({
          appLocale: AppLocaleSchema.make("en"),
          publicPath: "subjects/mathematics/functions",
        }).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PreviewIntegrityError",
        check: "projection",
      });
    })
  );

  it.effect("rejects a missing or mismatched material preview projection", () =>
    Effect.gen(function* () {
      prerenderManifestMock.mockRejectedValueOnce(
        new PreviewIntegrityError({ check: "manifest" })
      );
      expect(
        yield* fromPreviewPromise(() =>
          readMaterialPreviewStaticParams(AppLocaleSchema.make("en"))
        ).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PreviewIntegrityError",
        check: "manifest",
      });

      prerenderManifestMock.mockResolvedValueOnce(articlePendingManifest);
      expect(
        yield* fromPreviewPromise(() =>
          readMaterialPreviewStaticParams(AppLocaleSchema.make("en"))
        ).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PreviewIntegrityError",
        check: "projection",
      });

      prerenderManifestMock.mockResolvedValueOnce(
        pendingRoute({ publicPath: "subjects/mathematics/functions" })
      );
      expect(
        yield* fromPreviewPromise(() =>
          readMaterialPreviewStaticParams(AppLocaleSchema.make("en"))
        ).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PreviewIntegrityError",
        check: "projection",
      });
    })
  );

  it.effect("rejects a missing or mismatched article preview projection", () =>
    Effect.gen(function* () {
      prerenderManifestMock.mockRejectedValueOnce(
        new PreviewIntegrityError({ check: "manifest" })
      );
      expect(
        yield* fromPreviewPromise(() =>
          readArticlePreviewStaticParams(AppLocaleSchema.make("en"))
        ).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PreviewIntegrityError",
        check: "manifest",
      });

      prerenderManifestMock.mockResolvedValueOnce(makePendingManifest());
      expect(
        yield* fromPreviewPromise(() =>
          readArticlePreviewStaticParams(AppLocaleSchema.make("en"))
        ).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PreviewIntegrityError",
        check: "projection",
      });
    })
  );

  it.effect("rejects a missing or mismatched Page preview projection", () =>
    Effect.gen(function* () {
      prerenderManifestMock.mockRejectedValueOnce(
        new PreviewIntegrityError({ check: "manifest" })
      );
      expect(
        yield* fromPreviewPromise(() =>
          readPagePreviewStaticParams(AppLocaleSchema.make("en"))
        ).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PreviewIntegrityError",
        check: "manifest",
      });

      prerenderManifestMock.mockResolvedValueOnce(makePendingManifest());
      expect(
        yield* fromPreviewPromise(() =>
          readPagePreviewStaticParams(AppLocaleSchema.make("en"))
        ).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PreviewIntegrityError",
        check: "projection",
      });
    })
  );

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

  it.effect.each([
    ["missing locale hint", null, "/en/materials/math/topic/lesson"],
    ["unsupported locale", "de", "/de/materials/math/topic/lesson"],
    ["public namespace", "en", "/en/subjects/math/topic/lesson"],
    ["short route", "en", "/en/materials/math/topic"],
    ["other document", "en", "/en/materials/math/topic/lesson"],
  ] as const)("rejects an invalid %s", ([_label, localeHint, pathname]) =>
    Effect.gen(function* () {
      expect(yield* matchInternal(pathname, localeHint)).toBe(false);
    })
  );
});
