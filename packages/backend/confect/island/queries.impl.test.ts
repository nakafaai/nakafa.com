import { describe, expect, it } from "@effect/vitest";
import island from "@repo/backend/confect/_generated/refs/island";
import { Layout } from "@repo/backend/confect/island/layout";
import { STARTER_LAYOUT } from "@repo/backend/confect/island/starter";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { client } from "@repo/backend/test/client";
import { seedSchoolMember } from "@repo/backend/test/member";
import { DateTime, Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 10, 8, 3, 0, 0);
const JAKARTA = DateTime.zoneMakeNamedUnsafe("Asia/Jakarta");
const BERLIN = DateTime.zoneMakeNamedUnsafe("Europe/Berlin");
const DAY = 24 * 60 * 60 * 1000;

/** An owner with the username `nabil` and a stranger, both signed in. */
const islandWorld = Effect.fn("test.island.world")(function* () {
  vi.useFakeTimers({ now: NOW });
  const t = createConvexTestWithAuth();
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
    client(t.withIdentity({ subject: user.sessionId }));
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
          materials: { petals: 0, wood: 0 },
          size: 6,
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
          size: 6,
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

  it.effect(
    "waters the garden once a day on a day of learning, and harvests a grown plant into materials",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: JAKARTA,
        });
        const water = (version: number) =>
          world.owner.mutation(island.mutations.water, { version });
        const learnOn = (day: number) =>
          Effect.promise(async () => {
            vi.setSystemTime(NOW + day * DAY);
            await world.t.run(async (ctx) => {
              const stored = await ctx.db.query("islands").first();
              if (stored) {
                await ctx.db.patch("islands", stored._id, {
                  learned: `2026-11-${String(8 + day).padStart(2, "0")}`,
                });
              }
            });
          });
        expect(yield* water(0).pipe(Effect.flip)).toMatchObject({
          _tag: "FarmRefused",
          reason: "unlearned",
        });
        yield* learnOn(0);
        expect(yield* water(0)).toEqual({ version: 1 });
        expect(yield* world.owner.query(island.queries.own, {})).toMatchObject({
          learned: "2026-11-08",
          watered: "2026-11-08",
        });
        expect(yield* water(1).pipe(Effect.flip)).toMatchObject({
          _tag: "FarmRefused",
          reason: "watered",
        });
        expect(yield* water(0).pipe(Effect.flip)).toMatchObject({
          _tag: "IslandStale",
          version: 1,
        });
        const harvest = (version: number) =>
          world.owner.mutation(island.mutations.harvest, {
            at: { x: 1, y: 1, z: 0 },
            version,
          });
        expect(yield* harvest(1).pipe(Effect.flip)).toMatchObject({
          _tag: "FarmRefused",
          reason: "unripe",
        });
        for (const day of [1, 2, 3]) {
          yield* learnOn(day);
          yield* water(day);
        }
        expect(yield* harvest(0).pipe(Effect.flip)).toMatchObject({
          _tag: "IslandStale",
        });
        expect(yield* harvest(4)).toEqual({ version: 5 });
        const own = yield* world.owner.query(island.queries.own, {});
        expect(own?.materials).toEqual({ petals: 0, wood: 4 });
        expect(own?.layout[1]).toMatchObject({ growth: 0, stage: 2 });
        yield* Effect.promise(() =>
          world.t.run(async (ctx) => {
            const stored = await ctx.db.query("islands").first();
            if (stored) {
              await ctx.db.patch("islands", stored._id, {
                layout: Schema.encodeSync(Layout)([STARTER_LAYOUT[0]]),
              });
            }
          })
        );
        yield* learnOn(4);
        expect(yield* water(5).pipe(Effect.flip)).toMatchObject({
          _tag: "FarmRefused",
          reason: "barren",
        });
      })
  );
});
