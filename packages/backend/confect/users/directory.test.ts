import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  getAppUserByAuthId,
  getUserMap,
} from "@repo/backend/confect/users/directory";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, HashMap, Option } from "effect";

describe("users/directory", () => {
  it.effect(
    "returns an empty map without reading documents for no requested users",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const get = vi.spyOn(tCtx.db, "get");
            expect(HashMap.isEmpty(yield* getUserMap([]))).toBe(true);
            expect(get).not.toHaveBeenCalled();
          })
        );
      })
  );
  it.effect(
    "deduplicates requested IDs and preserves surviving user data when a user is missing",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            let ids: Id<"users">[] = [];
            for (const suffix of ["first", "missing", "second"]) {
              ids = Arr.append(
                ids,
                yield* Effect.promise(() =>
                  tCtx.db.insert("users", {
                    authId: `auth-${suffix}`,
                    credits: 100,
                    creditsResetAt: 0,
                    email: `${suffix}@example.com`,
                    image: `/avatars/${suffix}.png`,
                    name: suffix,
                    plan: "free",
                  })
                )
              );
            }
            const [firstId, missingId, secondId] = ids;
            yield* Effect.promise(() => tCtx.db.delete("users", missingId));
            const get = vi.spyOn(tCtx.db, "get");
            const users = yield* getUserMap([
              firstId,
              missingId,
              firstId,
              secondId,
            ]);
            expect(get).toHaveBeenCalledTimes(3);
            expect(HashMap.size(users)).toBe(2);
            expect([...HashMap.keys(users)]).toEqual(
              expect.arrayContaining([firstId, secondId])
            );
            expect(Option.getOrUndefined(HashMap.get(users, firstId))).toEqual({
              _id: firstId,
              email: "first@example.com",
              image: "/avatars/first.png",
              name: "first",
            });
            expect(
              Option.getOrUndefined(HashMap.get(users, secondId))?.name
            ).toBe("second");
            expect(HashMap.has(users, missingId)).toBe(false);
          })
        );
      })
  );
  it.effect(
    "looks up the app user by auth identity and returns null for an unknown identity",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const userId = yield* Effect.promise(() =>
              tCtx.db.insert("users", {
                authId: "auth-known",
                credits: 100,
                creditsResetAt: 0,
                email: "known@example.com",
                name: "Known user",
                plan: "free",
              })
            );
            expect(yield* getAppUserByAuthId("auth-known")).toMatchObject({
              _id: userId,
              name: "Known user",
            });
            expect(yield* getAppUserByAuthId("auth-missing")).toBeNull();
          })
        );
      })
  );
});
