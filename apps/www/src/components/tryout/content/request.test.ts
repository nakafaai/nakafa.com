import { describe, expect, it } from "@effect/vitest";
import { decodeProtectedContentRuntimeRequest } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { Effect } from "effect";
import type { TryoutQuestionSelector } from "@/components/tryout/content/model";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";

const digest = `sha256:${"a".repeat(64)}`;
const contentKey =
  "question-bank/tryout/indonesia/snbt/general-reasoning/set-1/question-1/question";
const question: TryoutQuestionSelector = {
  appLocale: "en",
  artifactHash: digest,
  bundleHash: digest,
  contentHash: "current-content-hash",
  contentKey,
  delivery: "authenticated",
  questionOrder: 1,
  sectionKey: "general-reasoning",
  snapshotId: digest,
  snapshotReleaseId: "current-release",
  sourcePath: `packages/corpus/${contentKey.slice(0, -9)}`,
  sourceRevision: "current-source",
};
describe("try-out protected runtime requests", () => {
  it.effect("rejects an empty protected content batch", () =>
    Effect.gen(function* () {
      expect(
        yield* makeTryoutRuntimeRequest([]).pipe(Effect.flip)
      ).toBeInstanceOf(ContentRuntimeVerificationError);
    })
  );

  it.effect("keeps the request bound to one permanent bundle", () =>
    Effect.gen(function* () {
      const request = yield* makeTryoutRuntimeRequest([question]);

      expect(yield* decodeProtectedContentRuntimeRequest(request)).toEqual(
        request
      );
      expect(request).not.toHaveProperty("attemptId");
      expect(request.selectors[0]).not.toHaveProperty("artifactLocale");
    })
  );

  it.effect("fails before transport when one batch spans bundles", () =>
    Effect.gen(function* () {
      expect(
        yield* makeTryoutRuntimeRequest([
          question,
          { ...question, bundleHash: `sha256:${"b".repeat(64)}` },
        ]).pipe(Effect.flip)
      ).toBeInstanceOf(ContentRuntimeVerificationError);
    })
  );

  it.effect("fails before transport when one batch spans releases", () =>
    Effect.gen(function* () {
      expect(
        yield* makeTryoutRuntimeRequest([
          question,
          { ...question, snapshotReleaseId: "another-release" },
        ]).pipe(Effect.flip)
      ).toBeInstanceOf(ContentRuntimeVerificationError);
    })
  );
});
