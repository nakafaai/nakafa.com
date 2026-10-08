import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  getAppUserByAuthId,
  getUserMap,
} from "@repo/backend/confect/users/directory";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect } from "effect";

describe("users/directory", () => {
  it.effect(
    "returns an empty map without reading documents for no requested users",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.gen(function* () {
              const get = vi.spyOn(tCtx.db, "get");
              expect(yield* getUserMap([])).toEqual(new Map());
              expect(get).not.toHaveBeenCalled();
            });
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
            const [firstId, missingId, secondId] = yield* Effect.gen(
              function* () {
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
                return ids;
              }
            );
            yield* Effect.promise(() => tCtx.db.delete("users", missingId));
            yield* Effect.gen(function* () {
              const get = vi.spyOn(tCtx.db, "get");
              const users = yield* getUserMap([
                firstId,
                missingId,
                firstId,
                secondId,
              ]);
              expect(get).toHaveBeenCalledTimes(3);
              expect([...users.keys()]).toEqual([firstId, secondId]);
              expect(users.get(firstId)).toEqual({
                _id: firstId,
                email: "first@example.com",
                image: "/avatars/first.png",
                name: "first",
              });
              expect(users.get(secondId)?.name).toBe("second");
              expect(users.has(missingId)).toBe(false);
            });
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
            yield* Effect.gen(function* () {
              expect(yield* getAppUserByAuthId("auth-known")).toMatchObject({
                _id: userId,
                name: "Known user",
              });
              expect(yield* getAppUserByAuthId("auth-missing")).toBeNull();
            });
          })
        );
      })
  );
});
