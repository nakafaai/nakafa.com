// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ContentCacheScopeSchema,
  makeContentCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
import { Data, Effect } from "effect";
import {
  applyContentCache,
  applyReleaseContentCache,
  ContentCacheInvalidationError,
  invalidateContentCache,
} from "@/lib/content/cache";

const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const revalidateTagMock = vi.hoisted(() => vi.fn());

class TestCacheFailure extends Data.TaggedError("TestCacheFailure") {}

vi.mock("next/cache", () => ({
  /** Records cache profile usage without touching Next internals. */
  cacheLife: cacheLifeMock,
  /** Records cache tag usage without touching Next internals. */
  cacheTag: cacheTagMock,
  /** Records cache invalidation calls without touching Next internals. */
  revalidateTag: revalidateTagMock,
}));
describe("content runtime cache", () => {
  beforeEach(() => {
    cacheLifeMock.mockClear();
    cacheTagMock.mockClear();
    revalidateTagMock.mockClear();
  });
  it("keeps combined mutable dependencies explicit", () => {
    applyContentCache("material", "program");
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-scope:material",
      "content-scope:program"
    );
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
  });
  it("keeps the scope tag of an entry keyed by its release and drops its timer", () => {
    applyReleaseContentCache("article");

    expect(cacheTagMock).toHaveBeenCalledWith("content-scope:article");
    expect(cacheLifeMock).toHaveBeenCalledExactlyOnceWith("max");
  });
  it.effect.each(ContentCacheScopeSchema.literals)(
    "invalidates only the changed %s dependency",
    (scope) =>
      Effect.gen(function* () {
        expect(yield* invalidateContentCache(scope)).toBe(scope);
        expect(revalidateTagMock.mock.calls).toEqual([
          [makeContentCacheTag(scope), "max"],
        ]);
      })
  );
  it("revalidates through the runtime profile instead of deleting", () => {
    applyContentCache("material");

    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
  });
  it.effect("keeps a failed Next invalidation in the typed error channel", () =>
    Effect.gen(function* () {
      revalidateTagMock.mockImplementationOnce(() => {
        throw new TestCacheFailure();
      });

      expect(
        yield* invalidateContentCache("material").pipe(Effect.flip)
      ).toEqual(new ContentCacheInvalidationError());
    })
  );
});
