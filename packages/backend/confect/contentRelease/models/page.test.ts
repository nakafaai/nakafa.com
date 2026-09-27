import { assert, describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { advanceModelPage } from "@repo/backend/confect/contentRelease/models/page";
import { decodeReleaseJson } from "@repo/backend/confect/contentRelease/parse";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  CANDIDATE,
  seedVerifiedPair,
} from "@repo/backend/test/activation/fixture";
import { insertModelBuild } from "@repo/backend/test/content/model";
import { Effect } from "effect";

describe("model page advancement", () => {
  it.effect("rejects a completed coordinator before any model writes", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() => seedVerifiedPair(tCtx));
          const build = yield* Effect.promise(() =>
            insertModelBuild(tCtx, "ready")
          );
          expect(
            yield* Effect.gen(function* () {
              const release = yield* (yield* DatabaseReader)
                .table("contentReleases")
                .get("by_releaseId", CANDIDATE.releaseId);
              assert(release);
              return yield* Effect.gen(function* () {
                const signed = yield* decodeReleaseJson(release.releaseJson);
                return yield* advanceModelPage(build, release, signed);
              });
            }).pipe(Effect.flip)
          ).toMatchObject({
            message: expect.stringContaining("cannot advance phase ready"),
          });
          expect(
            yield* Effect.promise(() =>
              tCtx.db.query("contentModelBuilds").unique()
            )
          ).toEqual(build);
        })
      );
    })
  );
});
