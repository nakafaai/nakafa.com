import { describe, expect, it } from "@effect/vitest";
import island from "@repo/backend/confect/_generated/refs/island";
import { STARTER_LAYOUT } from "@repo/backend/confect/island/starter";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { client } from "@repo/backend/test/client";
import { seedSchoolMember } from "@repo/backend/test/member";
import { DateTime, Effect } from "effect";

const NOW = Date.UTC(2026, 10, 8, 3, 0, 0);
const JAKARTA = DateTime.zoneMakeNamedUnsafe("Asia/Jakarta");
const BERLIN = DateTime.zoneMakeNamedUnsafe("Europe/Berlin");

/** An owner with the username `nabil` and a stranger, both signed in. */
const islandWorld = Effect.fn("test.island.world")(function* () {
  vi.useFakeTimers({ now: NOW });
  const t = createConvexTestWithBetterAuth();
  const { owner, stranger } = yield* Effect.promise(() =>
    t.mutation(async (ctx) => {
      const owner = await seedAuthenticatedUser(ctx, {
        name: "Nabil",
        now: NOW,
        suffix: "owner",
      });
      await ctx.db.patch("users", owner.userId, { username: "nabil" });
      const stranger = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "stranger",
      });
      return { owner, stranger };
    })
  );
  const as = (user: typeof owner) =>
    client(
      t.withIdentity({ sessionId: user.sessionId, subject: user.authUserId })
    );
  return { owner: as(owner), ownerId: owner.userId, stranger: as(stranger), t };
});

describe("island queries and mutations", () => {
  it.effect(
    "opens the owner's island with the starter set and keeps its zone at theirs",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        const visitor = client(world.t);
        expect(yield* visitor.query(island.queries.own, {})).toBeNull();
        expect(yield* world.owner.query(island.queries.own, {})).toBeNull();
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: JAKARTA,
        });
        expect(yield* world.owner.query(island.queries.own, {})).toEqual({
          badges: [],
          layout: STARTER_LAYOUT,
          level: 1,
          lifetime: 0,
          stars: 0,
          timeZone: "Asia/Jakarta",
          version: 0,
          visibility: "private",
        });
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: JAKARTA,
        });
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: BERLIN,
        });
        expect(
          (yield* world.owner.query(island.queries.own, {}))?.timeZone
        ).toBe("Europe/Berlin");
        expect(
          (yield* visitor
            .mutation(island.mutations.open, { timeZone: BERLIN })
            .pipe(Effect.flip))._tag
        ).toBe("SessionRequired");
      })
  );

  it.effect(
    "shows a shared island to visitors without its Stars, and a private one to nobody",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        const visitor = client(world.t);
        expect(
          yield* visitor.query(island.queries.visit, { username: "nabil" })
        ).toBeNull();
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: JAKARTA,
        });
        expect(
          yield* visitor.query(island.queries.visit, { username: "nabil" })
        ).toBeNull();
        yield* world.owner.mutation(island.mutations.share, {
          visibility: "link",
        });
        yield* world.owner.mutation(island.mutations.share, {
          visibility: "link",
        });
        const visited = yield* visitor.query(island.queries.visit, {
          username: "nabil",
        });
        expect(visited).toMatchObject({
          badges: [],
          layout: STARTER_LAYOUT,
          level: 1,
          name: "Nabil",
          timeZone: "Asia/Jakarta",
          username: "nabil",
        });
        expect(visited).not.toHaveProperty("stars");
        expect(visited).not.toHaveProperty("lifetime");
        expect(
          yield* world.stranger.query(island.queries.visit, {
            username: "nobodyholdsthis",
          })
        ).toBeNull();
        yield* world.owner.mutation(island.mutations.share, {
          visibility: "private",
        });
        expect(
          yield* world.stranger.query(island.queries.visit, {
            username: "nabil",
          })
        ).toBeNull();
      })
  );

  it.effect(
    "keeps a school member's island with its owner, as their profile is (K15)",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        yield* world.owner.mutation(island.mutations.share, {
          visibility: "public",
        });
        yield* Effect.promise(() =>
          world.t.mutation((ctx) => seedSchoolMember(ctx, world.ownerId, NOW))
        );
        expect(
          yield* world.stranger.query(island.queries.visit, {
            username: "nabil",
          })
        ).toBeNull();
        expect(
          yield* world.owner.query(island.queries.visit, { username: "nabil" })
        ).toMatchObject({ timeZone: "UTC" });
      })
  );

  it.effect("answers a deleted owner's island as one that does not exist", () =>
    Effect.gen(function* () {
      const world = yield* islandWorld();
      yield* world.owner.mutation(island.mutations.share, {
        visibility: "public",
      });
      yield* Effect.promise(() =>
        world.t.mutation((ctx) =>
          ctx.db.patch("users", world.ownerId, { deletedAt: NOW })
        )
      );
      expect(
        yield* world.stranger.query(island.queries.visit, { username: "nabil" })
      ).toBeNull();
    })
  );

  it.effect(
    "applies a batch of changes under the next version, and refuses a stale one or a broken one whole",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: JAKARTA,
        });
        yield* Effect.promise(() =>
          world.t.run(async (ctx) => {
            const own = await ctx.db.query("islands").first();
            if (own) {
              await ctx.db.patch("islands", own._id, { lifetime: 20 });
            }
          })
        );
        const placed = yield* world.owner.mutation(island.mutations.edit, {
          operations: [
            {
              _tag: "place",
              at: { x: 0, y: 5, z: 0 },
              item: "grass",
              rotation: 0,
              stage: 0,
            },
          ],
          version: 0,
        });
        expect(placed).toEqual({ version: 1 });
        const own = yield* world.owner.query(island.queries.own, {});
        expect(own).toMatchObject({ stars: 18, version: 1 });
        expect(own?.layout).toHaveLength(3);
        const stale = yield* world.owner
          .mutation(island.mutations.edit, { operations: [], version: 0 })
          .pipe(Effect.flip);
        expect(stale).toMatchObject({ _tag: "IslandStale", version: 1 });
        const refused = yield* world.owner
          .mutation(island.mutations.edit, {
            operations: [{ _tag: "remove", at: { x: 3, y: 2, z: 0 } }],
            version: 1,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "BuildRefused",
          index: 0,
          reason: "starter",
        });
        expect(
          (yield* world.owner.query(island.queries.own, {}))?.version
        ).toBe(1);
      })
  );
});
