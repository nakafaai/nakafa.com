// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect } from "effect";
import {
  readPreviewManifest,
  readPreviewSnapshot,
} from "@/lib/content/preview/manifest";
import { matchesPreviewRoute } from "@/lib/content/preview/route";
import {
  makePendingManifest,
  previewConfig,
  previewRoute,
} from "@/test/manifest";

vi.mock("@/lib/content/preview/manifest", () => ({
  readPreviewManifest: vi.fn(),
  readPreviewSnapshot: vi.fn(),
}));

const prerenderManifestMock = vi.mocked(readPreviewManifest);
const snapshotMock = vi.mocked(readPreviewSnapshot);

/** Runs one public preview route decision. */
function matchPublic(publicPath: string = previewRoute.publicPath) {
  return matchesPreviewRoute({ appLocale: previewRoute.appLocale, publicPath });
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
});
