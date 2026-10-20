// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  type LocalPreviewManifest,
  LocalPreviewManifestSchema,
} from "@nakafa/aksara-contracts/preview/spec";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { Effect, Schema } from "effect";
import {
  readPreviewManifest,
  readPreviewSnapshot,
} from "@/lib/content/preview/manifest";
import {
  type MaterialPreviewRouteInput,
  matchesInternalPreviewRoute,
  matchesMaterialPreviewRoute,
  matchesPreviewPathname,
  matchesPreviewRoute,
} from "@/lib/content/preview/route";
import {
  makePendingManifest,
  previewConfig,
  previewDocument,
  previewRoute,
} from "@/test/content-preview";
import { articlePendingManifest } from "@/test/preview-article";

vi.mock("@/lib/content/preview/manifest", () => ({
  readPreviewManifest: vi.fn(),
  readPreviewSnapshot: vi.fn(),
}));

const prerenderManifestMock = vi.mocked(readPreviewManifest);
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

/** Runs one locale seam internal rewrite decision. */
function matchInternal(
  pathname = "/en/materials/mathematics/function-composition-inverse-function/function-concept",
  localeHint: string | null = "en"
) {
  return matchesInternalPreviewRoute({ localeHint, pathname });
}

beforeEach(() => {
  prerenderManifestMock.mockReset();
  prerenderManifestMock.mockReturnValue(Effect.succeed(makePendingManifest()));
  snapshotMock.mockReset();
  snapshotMock.mockReturnValue(
    Effect.succeedSome({
      config: previewConfig,
      manifest: makePendingManifest(),
    })
  );
});

describe("local preview route matching", () => {
  it.effect("leaves every route unchanged when preview is disabled", () =>
    Effect.gen(function* () {
      snapshotMock.mockReturnValueOnce(Effect.succeedNone);

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
      expect(yield* matchesPreviewPathname("/en/user/settings/memory")).toBe(
        false
      );
      expect(yield* matchesPreviewPathname("/de")).toBe(false);
    })
  );

  it.effect("maps the exact locale seam internal material rewrite", () =>
    Effect.gen(function* () {
      expect(yield* matchInternal()).toBe(true);
    })
  );

  it("matches the mathematics route without consulting a static catalog", () => {
    expect(matchesMaterialPreviewRoute(pendingRoute(), materialInput)).toBe(
      true
    );
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
