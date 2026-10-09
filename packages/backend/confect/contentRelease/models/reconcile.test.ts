import { expect, it } from "@effect/vitest";

import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { reconcileModel } from "@repo/backend/confect/contentRelease/models/reconcile";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { insertModelBuild } from "@repo/backend/test/content/model";
import { Effect } from "effect";

it.effect(
  "fails closed when a stored indexed row violates its decoded contract",
  () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            tCtx.db.insert("contentIndex", {
              appLocale: "en",
              contentKey: "article:filtered",
              family: "article",
              projectionHash: "sha256:projection",
              publicPath: "articles/filtered",
              releaseId: "active",
              sequence: Number.NaN,
              slot: "blue",
              text: "A public article must not silently disappear.",
            })
          );
          const build = yield* Effect.promise(() =>
            insertModelBuild(tCtx, "search")
          );
          const insert = vi.fn(() => Effect.void);
          const replace = vi.fn(() => Effect.void);
          const remove = vi.fn(() => Effect.void);
          expect(
            yield* Effect.gen(function* () {
              const query = (yield* DatabaseReader).table("contentIndex");
              return yield* reconcileModel({
                build,
                source: query.stream(
                  "by_slot_and_contentKey_and_appLocale",
                  (index) => index.eq("slot", "blue")
                ),
                target: query.stream(
                  "by_slot_and_contentKey_and_appLocale",
                  (index) => index.eq("slot", "green")
                ),
                sourceSlot: "blue",
                targetSlot: "green",
                position: (row) => [row.contentKey, row.appLocale],
                insert,
                replace,
                remove,
              });
            }).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: "Model phase search contains an invalid stored row.",
          });
          expect(insert).not.toHaveBeenCalled();
          expect(replace).not.toHaveBeenCalled();
          expect(remove).not.toHaveBeenCalled();
        })
      );
    })
);
