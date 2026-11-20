import { describe, expect, it } from "@effect/vitest";
import island from "@repo/backend/confect/_generated/refs/island";
import { ISLAND_NOW, islandWorld } from "@repo/backend/test/island";
import { Array as Arr, DateTime, Effect } from "effect";

const JAKARTA = DateTime.zoneMakeNamedUnsafe("Asia/Jakarta");
const BERLIN = DateTime.zoneMakeNamedUnsafe("Europe/Berlin");
const HOUR = 3_600_000;

/** Gives the first island these lifetime Stars, as grants would. */
const earn = (
  world: Effect.Success<ReturnType<typeof islandWorld>>,
  lifetime: number
) =>
  Effect.promise(() =>
    world.t.run(async (ctx) => {
      const row = await ctx.db.query("islands").first();
      if (row !== null) {
        await ctx.db.patch("islands", row._id, { lifetime });
      }
    })
  );

describe("island mutations", () => {
  it.effect(
    "opens the learner's island, keeps its zone at theirs, and tells when they entered before",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        const open = (timeZone: DateTime.TimeZone.Named) =>
          world.owner.mutation(island.mutations.open, { timeZone });
        expect(yield* open(JAKARTA)).toEqual({ entered: null });
        vi.setSystemTime(ISLAND_NOW + HOUR);
        expect(yield* open(BERLIN)).toEqual({ entered: ISLAND_NOW });
        expect(yield* open(BERLIN)).toEqual({ entered: ISLAND_NOW + HOUR });
        const zones = yield* Effect.promise(() =>
          world.t.run(async (ctx) =>
            Arr.map(
              await ctx.db.query("islands").collect(),
              (row) => row.timeZone
            )
          )
        );
        expect(zones).toEqual(["Europe/Berlin"]);
        expect(
          (yield* world.anyone
            .mutation(island.mutations.open, { timeZone: BERLIN })
            .pipe(Effect.flip))._tag
        ).toBe("SessionRequired");
      })
  );

  it.effect(
    "opens a blueprint for its price in Stars, once, and refuses one the balance does not reach",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        const unlock = (kind: "bench" | "cottage" | "lighthouse") =>
          world.owner.mutation(island.mutations.unlock, { kind });
        expect(yield* unlock("cottage").pipe(Effect.flip)).toMatchObject({
          _tag: "Short",
          balance: 0,
          price: 40,
        });
        expect(yield* unlock("bench")).toEqual({ balance: 0, blueprints: [] });
        yield* earn(world, 100);
        expect(yield* unlock("cottage")).toEqual({
          balance: 60,
          blueprints: ["cottage"],
        });
        // A second time costs nothing more.
        expect(yield* unlock("cottage")).toEqual({
          balance: 60,
          blueprints: ["cottage"],
        });
        expect(yield* unlock("lighthouse").pipe(Effect.flip)).toMatchObject({
          _tag: "Short",
          balance: 60,
          price: 120,
        });
        expect(yield* world.owner.query(island.queries.own, {})).toMatchObject({
          balance: 60,
          blueprints: ["cottage"],
          lifetime: 100,
        });
        // The blueprint builds the thing as often as the learner likes.
        const cottage = { cx: 0, cz: 0, kind: "cottage", turn: 2 } as const;
        expect(
          yield* world.owner.mutation(island.mutations.change, {
            ops: [
              { _tag: "set", at: 1, ...cottage },
              { _tag: "set", at: 900, ...cottage },
            ],
          })
        ).toEqual(["done", "done"]);
        expect(
          (yield* world.anyone
            .mutation(island.mutations.unlock, { kind: "cottage" })
            .pipe(Effect.flip))._tag
        ).toBe("SessionRequired");
      })
  );

  it.effect(
    "closes a private world to everyone but its owner, and opens one shared by link to a visitor signed out",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        const visit = (caller: typeof world.owner) =>
          caller.query(island.queries.visit, { username: "ayu" });
        const share = (access: "link" | "private" | "public") =>
          world.owner.mutation(island.mutations.share, { access });
        expect(yield* share("private")).toBeNull();
        expect(yield* visit(world.visitor)).toBeNull();
        expect(yield* visit(world.anyone)).toBeNull();
        expect(yield* visit(world.owner)).toMatchObject({
          access: "private",
          own: true,
        });
        yield* share("link");
        expect(yield* visit(world.anyone)).toMatchObject({
          access: "link",
          own: false,
        });
        yield* share("public");
        expect(yield* visit(world.visitor)).toMatchObject({
          access: "public",
          own: false,
        });
        expect(
          (yield* world.anyone
            .mutation(island.mutations.share, { access: "public" })
            .pipe(Effect.flip))._tag
        ).toBe("SessionRequired");
      })
  );

  it.effect(
    "keeps one sticker for each visitor in a guest book, a second one replacing the first",
    () =>
      Effect.gen(function* () {
        const world = yield* islandWorld();
        const greet = (
          caller: typeof world.owner,
          sticker: "heart" | "wave",
          username = "ayu"
        ) => caller.mutation(island.mutations.greet, { sticker, username });
        const refused = (greeting: ReturnType<typeof greet>) =>
          greeting.pipe(
            Effect.flip,
            Effect.map((error) => error._tag)
          );
        // No world stands at the address before its owner first enters.
        expect(yield* refused(greet(world.visitor, "wave"))).toBe("Closed");
        yield* world.owner.mutation(island.mutations.open, {
          timeZone: JAKARTA,
        });
        expect(yield* greet(world.visitor, "wave")).toBeNull();
        vi.setSystemTime(ISLAND_NOW + HOUR);
        yield* greet(world.visitor, "heart");
        expect(yield* world.owner.query(island.queries.guests, {})).toEqual([
          {
            at: ISLAND_NOW + HOUR,
            mascot: expect.anything(),
            name: "Budi",
            sticker: "heart",
          },
        ]);
        expect(yield* refused(greet(world.owner, "wave"))).toBe("Closed");
        expect(yield* refused(greet(world.visitor, "wave", "nobody"))).toBe(
          "Closed"
        );
        expect(yield* refused(greet(world.anyone, "wave"))).toBe(
          "SessionRequired"
        );
        yield* world.owner.mutation(island.mutations.share, {
          access: "private",
        });
        expect(yield* refused(greet(world.visitor, "wave"))).toBe("Closed");
        // A guest book is its owner's alone, and a guest whose account is gone leaves it.
        expect(yield* world.visitor.query(island.queries.guests, {})).toEqual(
          []
        );
        expect(yield* world.anyone.query(island.queries.guests, {})).toEqual(
          []
        );
        yield* Effect.promise(() =>
          world.t.run((ctx) => ctx.db.delete("users", world.visitorId))
        );
        expect(yield* world.owner.query(island.queries.guests, {})).toEqual([]);
      })
  );
});
