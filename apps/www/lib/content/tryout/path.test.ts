// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { makeTryoutRuntimeSource } from "@repo/backend/test/tryout/serving";
import { Effect } from "effect";
import { readPublishedTryoutLocalizedPath } from "@/lib/content/tryout/path";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import { createTestSnapshotQuery } from "@/test/runtime-query";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: runtimeQueryMock,
}));

describe("published try-out localized paths", () => {
  beforeEach(() => {
    runtimeQueryMock.mockReset();
  });

  it.effect.each(APP_LOCALE_CODES)(
    "resolves the signed set and section identity into %s",
    (targetAppLocale) =>
      Effect.gen(function* () {
        const fixture = yield* makeTryoutRuntimeSource();
        const context = yield* createTestSnapshotContext(fixture.source);
        runtimeQueryMock.mockImplementation(createTestSnapshotQuery(context));
        for (const publicPath of [
          "try-out/indonesia/tka/matematika/set-1",
          "try-out/indonesia/tka/matematika/set-1/matematika",
        ]) {
          expect(
            yield* readPublishedTryoutLocalizedPath({
              currentAppLocale: "en",
              publicPath,
              targetAppLocale,
            })
          ).toBe(publicPath);
        }
      })
  );

  it.effect("returns no localized route for an absent signed identity", () =>
    Effect.gen(function* () {
      const fixture = yield* makeTryoutRuntimeSource();
      const context = yield* createTestSnapshotContext(fixture.source);
      runtimeQueryMock.mockImplementation(createTestSnapshotQuery(context));
      expect(
        yield* readPublishedTryoutLocalizedPath({
          currentAppLocale: "id",
          publicPath: "try-out/indonesia/tka/matematika/missing-set",
          targetAppLocale: "de",
        })
      ).toBeNull();
    })
  );
});
