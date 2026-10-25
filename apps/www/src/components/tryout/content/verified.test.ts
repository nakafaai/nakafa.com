// @vitest-environment node

import { Ref } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { createRendererManifest } from "@nakafa/aksara-contracts/renderer/manifest";
import refs from "@repo/backend/confect/_generated/refs";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { insertHistoryAttempt } from "@repo/backend/test/tryout/history";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Array as Arr, Effect } from "effect";
import type { SignedContentAccess } from "@/components/tryout/content/model";
import { renderSignedTryoutRows } from "@/components/tryout/content/signed";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import { activateTestRelease } from "@/test/active";
import { resetTestRuntimeCache } from "@/test/store";

const TEST_RELEASE_ID = "release-verified-test";
const attemptQuery = refs.public.tryouts.queries.content.getBatch;

const liveRendererMock = vi.hoisted(() => vi.fn<() => unknown>());
const trustedKeysMock = vi.hoisted(() => vi.fn<() => unknown>());

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.test/en/try-out"),
}));
vi.mock("@/lib/auth/session.server", () => ({
  readSessionMemo: vi.fn(),
}));
vi.mock("@repo/site/keys", () => ({
  contentRuntimeKeys: () => ({ CONTENT_RUNTIME_TOKEN: "technical-test-token" }),
}));
vi.mock("@/env.public", () => ({
  clientEnv: { VITE_CONVEX_URL: "https://test.convex.cloud" },
}));
vi.mock("@/env", () => ({
  env: { VITE_CONVEX_SITE_URL: "https://runtime.example.test" },
}));

vi.mock("@repo/backend/content/trust", async () => {
  const { TEST_KEY_RESOLVER } = await import(
    "@repo/backend/test/content/proof"
  );
  return {
    contentKeyResolver: TEST_KEY_RESOLVER,
    get trustedContentKeys() {
      return trustedKeysMock() ?? [];
    },
  };
});
vi.mock("@/lib/content/renderer/manifest", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/content/renderer/manifest")>();
  return {
    get rendererManifest() {
      return liveRendererMock() ?? actual.rendererManifest;
    },
  };
});
type AttemptContentModule =
  typeof import("@repo/backend/client/content/attempt");
const verifyAttemptSpy = vi.hoisted(() =>
  vi.fn<AttemptContentModule["verifyAttemptContent"]>()
);
vi.mock("@repo/backend/client/content/attempt", async (importOriginal) => {
  const actual = await importOriginal<AttemptContentModule>();
  verifyAttemptSpy.mockImplementation(actual.verifyAttemptContent);
  return { ...actual, verifyAttemptContent: verifyAttemptSpy };
});
vi.mock(
  "@/lib/content/store/memory",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);
vi.mock(
  "@/lib/content/published/active",
  async () => (await import("@/test/active")).testActiveModule
);

/** Seeds one owned attempt and reads the row that its section page would return. */
const readOwnedRow = Effect.fn("TryoutVerifiedTest.ownedRow")(function* () {
  const t = createConvexTestWithBetterAuth();
  const seed = yield* Effect.promise(() =>
    t.mutation((ctx) =>
      insertHistoryAttempt(ctx, true, {
        bodyText: "Verified batch",
      })
    )
  );
  const owned = t.withIdentity({
    subject: seed.identity.authUserId,
    sessionId: seed.identity.sessionId,
  });
  const access: SignedContentAccess = {
    answers: Arr.filter(
      seed.request.selectors,
      (selector) => selector.delivery === "entitled"
    ),
    kind: "signed",
    previewAnswers: [],
    questions: Arr.filter(
      seed.request.selectors,
      (selector) => selector.delivery === "authenticated"
    ),
  };
  const row = yield* Effect.promise(() =>
    owned.query(Ref.getFunctionReference(attemptQuery), seed.request)
  );
  return { access, row: yield* Effect.fromNullishOr(row) };
});

beforeEach(() => {
  resetTestRuntimeCache();
  activateTestRelease(TEST_RELEASE_ID);
  vi.setSystemTime(TRYOUT_TEST_NOW);
  liveRendererMock.mockReset();
  trustedKeysMock.mockReset();
});

describe("verified try-out batch", () => {
  it.effect("does not keep a batch that fails verification", () =>
    Effect.gen(function* () {
      const { access, row } = yield* readOwnedRow();
      const truncated = { ...row, items: Arr.take(row.items, 1) };
      verifyAttemptSpy.mockClear();

      const first = yield* renderSignedTryoutRows(access, [truncated]).pipe(
        Effect.flip
      );
      const second = yield* renderSignedTryoutRows(access, [truncated]).pipe(
        Effect.flip
      );

      expect(first).toMatchObject({ _tag: "ContentRuntimeVerificationError" });
      expect(second).toMatchObject({ _tag: "ContentRuntimeVerificationError" });
      // A failed verdict is never kept, so the second read verifies again.
      expect(verifyAttemptSpy).toHaveBeenCalledTimes(2);
    })
  );

  it.effect(
    "verifies again when the live renderer or the trusted keys change",
    () =>
      Effect.gen(function* () {
        const { access, row } = yield* readOwnedRow();
        const current = yield* rendererManifest;
        const widened = yield* createRendererManifest({
          base: [...current.base, "VerificationProbe"],
          domains: current.domains,
          publishedDomains: current.publishedDomains,
        });
        verifyAttemptSpy.mockClear();

        yield* renderSignedTryoutRows(access, [row]);
        liveRendererMock.mockReturnValue(Effect.succeed(widened));
        yield* renderSignedTryoutRows(access, [row]);
        expect(verifyAttemptSpy).toHaveBeenCalledTimes(2);

        trustedKeysMock.mockReturnValue([
          { keyId: "retired-probe-key", publicKeyPem: "retired-probe-key" },
        ]);
        yield* renderSignedTryoutRows(access, [row]);
        expect(verifyAttemptSpy).toHaveBeenCalledTimes(3);
      })
  );
});
