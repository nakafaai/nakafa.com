// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import { makeTryoutRuntimeSource } from "@repo/backend/test/tryout/serving";
import { Effect } from "effect";
import {
  readPublishedTryoutSitemap,
  readPublishedTryoutSitemapCount,
} from "@/lib/content/tryout/sitemap";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import { createTestSnapshotQuery } from "@/test/runtime-query";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: runtimeQueryMock,
}));

describe("published try-out sitemap", () => {
  beforeEach(() => {
    runtimeQueryMock.mockReset();
  });

  it.effect.each(APP_LOCALE_CODES)(
    "reads the complete authenticated %s route inventory",
    (locale) =>
      Effect.gen(function* () {
        const fixture = yield* makeTryoutRuntimeSource();
        const context = yield* createTestSnapshotContext(fixture.source);
        runtimeQueryMock.mockImplementation(createTestSnapshotQuery(context));
        expect(yield* readPublishedTryoutSitemapCount(locale)).toEqual({
          pageCount: 1,
          routeCount: 5,
        });
        expect(yield* readPublishedTryoutSitemap(locale, 0)).toEqual({
          paths: [
            "try-out/indonesia",
            "try-out/indonesia/tka",
            "try-out/indonesia/tka/matematika",
            "try-out/indonesia/tka/matematika/set-1",
            "try-out/indonesia/tka/matematika/set-1/matematika",
          ],
        });
        expect(yield* readPublishedTryoutSitemap(locale, 1)).toBeNull();
        expect(yield* readPublishedTryoutSitemap(locale, -1)).toBeNull();
      })
  );

  it.effect(
    "fails closed when the authenticated release has no try-out snapshot",
    () =>
      Effect.gen(function* () {
        const inactive = yield* createTestSnapshotContext(
          makeRuntimeSource().source
        );
        runtimeQueryMock.mockImplementation(createTestSnapshotQuery(inactive));
        expect(
          yield* readPublishedTryoutSitemapCount("id").pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ReleaseError",
          code: "CONTENT_RELEASE_MISSING",
        });
      })
  );
});
