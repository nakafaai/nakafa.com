// @vitest-environment node

import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import {
  type LocalPreviewManifest,
  LocalPreviewManifestSchema,
} from "@nakafa/aksara-contracts/preview/spec";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { Effect, Option, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPreviewSnapshot } from "@/lib/content/preview/manifest";
import {
  decodeMaterialPreviewRoute,
  type MaterialPreviewRouteInput,
  matchesInternalPreviewRoute,
  matchesMaterialPreviewRoute,
  matchesPreviewRoute,
} from "@/lib/content/preview/route";
import {
  makePendingManifest,
  makeReadyManifest,
  previewConfig,
  previewManifestHash,
  previewMetadata,
  previewProjection,
  previewRoute,
} from "@/test/content-preview";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/content/preview/manifest", () => ({
  readPreviewSnapshot: vi.fn(),
}));

const snapshotMock = vi.mocked(readPreviewSnapshot);
const materialInput = {
  params: {
    lesson: ["function-concept"],
    locale: "en",
    topic: "function-composition-inverse-function",
  },
  target: "mathematics",
} as const;

/** Narrows a decoded manifest to the ready state expected by this test. */
function requireReady(manifest: LocalPreviewManifest) {
  if (manifest.status !== "ready") {
    throw new Error("Expected a ready preview manifest.");
  }

  return manifest;
}

/** Builds a strictly decoded pending manifest for route-matching cases. */
function pendingRoute({
  rendererDomain = "mathematics",
  publicPath = previewRoute.publicPath,
}: {
  readonly publicPath?: string;
  readonly rendererDomain?: RendererDomain;
} = {}) {
  const manifest = makePendingManifest();

  return Schema.decodeUnknownSync(LocalPreviewManifestSchema)({
    ...manifest,
    document: {
      ...manifest.document,
      rendererDomain,
      route: { ...manifest.document.route, publicPath },
    },
  });
}

const materialMismatchCases: readonly [
  string,
  LocalPreviewManifest,
  Partial<MaterialPreviewRouteInput>,
][] = [
  [
    "locale",
    pendingRoute(),
    { params: { ...materialInput.params, locale: "id" } },
  ],
  [
    "namespace",
    pendingRoute({
      publicPath:
        "materials/mathematics/function-composition-inverse-function/function-concept",
    }),
    {},
  ],
  [
    "renderer subject",
    pendingRoute({
      publicPath:
        "subjects/physics/function-composition-inverse-function/function-concept",
    }),
    {},
  ],
  [
    "topic",
    pendingRoute(),
    { params: { ...materialInput.params, topic: "other" } },
  ],
  [
    "lesson count",
    pendingRoute(),
    { params: { ...materialInput.params, lesson: [] } },
  ],
  [
    "missing lesson",
    pendingRoute(),
    {
      params: {
        locale: materialInput.params.locale,
        topic: materialInput.params.topic,
      },
    },
  ],
  [
    "lesson value",
    pendingRoute(),
    { params: { ...materialInput.params, lesson: ["other"] } },
  ],
  ["fixed domain", pendingRoute(), { target: "chemistry" }],
  [
    "generic subject",
    pendingRoute(),
    {
      params: { ...materialInput.params, subject: "physics" },
      target: "generic",
    },
  ],
  [
    "generic chemistry",
    pendingRoute({ rendererDomain: "chemistry" }),
    {
      params: { ...materialInput.params, subject: "mathematics" },
      target: "generic",
    },
  ],
  [
    "generic mathematics",
    pendingRoute(),
    {
      params: { ...materialInput.params, subject: "mathematics" },
      target: "generic",
    },
  ],
];

/** Runs one public preview route decision. */
function matchPublic(publicPath: string = previewRoute.publicPath) {
  return Effect.runPromise(
    matchesPreviewRoute({ locale: previewRoute.locale, publicPath })
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
          locale: "id",
          publicPath: previewRoute.publicPath,
        })
      )
    ).resolves.toBe(false);
  });

  it("maps the exact next-intl internal material rewrite", async () => {
    await expect(matchInternal()).resolves.toBe(true);
  });

  it("matches fixed and generic material routes without a static catalog", () => {
    expect(matchesMaterialPreviewRoute(pendingRoute(), materialInput)).toBe(
      true
    );
    expect(
      matchesMaterialPreviewRoute(
        pendingRoute({
          publicPath: "subjects/physics/measurement/dimension",
          rendererDomain: "physics",
        }),
        {
          params: {
            lesson: ["dimension"],
            locale: "en",
            subject: "physics",
            topic: "measurement",
          },
          target: "generic",
        }
      )
    ).toBe(true);
  });

  it.each(
    materialMismatchCases
  )("rejects a mismatched material %s", (_label, manifest, change) => {
    expect(
      matchesMaterialPreviewRoute(manifest, {
        params: change.params ?? materialInput.params,
        target: change.target ?? materialInput.target,
      })
    ).toBe(false);
  });

  it("derives the exact Nakafa route and rejects an invalid source identity", () => {
    const ready = requireReady(makeReadyManifest(previewManifestHash));
    const route = Effect.runSync(decodeMaterialPreviewRoute(ready));
    const invalidKey = ContentKeySchema.make("material:invalid");
    const invalid = requireReady(
      Schema.decodeUnknownSync(LocalPreviewManifestSchema)({
        ...ready,
        document: {
          ...ready.document,
          route: { ...ready.document.route, contentKey: invalidKey },
        },
        projection: { ...previewProjection, contentKey: invalidKey },
      })
    );

    expect(route).toMatchObject({
      description: previewMetadata.description,
      sourcePath: previewRoute.contentKey,
      title: previewMetadata.title,
    });
    expect(
      Effect.runSync(decodeMaterialPreviewRoute(invalid).pipe(Effect.flip))
    ).toMatchObject({ _tag: "PreviewIntegrityError", check: "projection" });
  });

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
