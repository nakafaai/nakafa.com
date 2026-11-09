import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import island from "@repo/backend/confect/_generated/refs/island";
import { SNAPSHOT_BYTE_LIMIT } from "@repo/backend/confect/island/snapshot";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import {
  fileRows,
  makeBucket,
  stubBucket,
  uploadReserved,
} from "@repo/backend/test/bucket";
import { client, inMutation } from "@repo/backend/test/client";
import { Array as Arr, Effect, Record as Rec } from "effect";

/** The fetch that R2 answers, stubbed once for the file. */
const fetcher = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetcher);
const bucket = makeBucket();

const NOW = Date.UTC(2026, 10, 8, 3, 0, 0);
const PNG = new Uint8Array([137, 80, 78, 71]);

/** The object key of a snapshot: the island's own folder, then a fresh UUID. */
const SNAPSHOT_KEY = /^islands\/[^/]+\/[0-9a-f-]{36}$/u;

/** An owner with the username `nabil`, whose island anyone with the link may visit, and a stranger. */
const snapshotWorld = Effect.fn("test.island.snapshot.world")(function* () {
  vi.useFakeTimers({ now: NOW });
  const t = createConvexTestWithBetterAuth();
  const users = yield* Effect.promise(() =>
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
  const as = (user: typeof users.owner) =>
    client(
      t.withIdentity({ sessionId: user.sessionId, subject: user.authUserId })
    );
  const owner = as(users.owner);
  yield* owner.mutation(island.mutations.share, { visibility: "link" });
  return {
    owner,
    ownerId: users.owner.userId,
    stranger: as(users.stranger),
    strangerId: users.stranger.userId,
    t,
  };
});

/** Reserves a snapshot as the given reader and uploads its bytes as the browser does. */
const uploaded = (
  reader: Effect.Success<ReturnType<typeof snapshotWorld>>["owner"]
) =>
  uploadReserved(
    bucket,
    reader.mutation(island.mutations.reserveSnapshot, {
      byteSize: PNG.byteLength,
    }),
    PNG
  );

/** The object keys of every file row, oldest first. */
const keysOf = (world: Effect.Success<ReturnType<typeof snapshotWorld>>) =>
  Effect.promise(() => world.t.run(inMutation(() => fileRows))).pipe(
    Effect.map(Arr.map((file) => file.objectKey))
  );

describe("island/snapshot", () => {
  beforeEach(() => {
    bucket.state.objects = {};
    fetcher.mockImplementation((input, init) => bucket.answer(input, init));
    stubBucket();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.effect(
    "reserves a snapshot under the island's own folder at an address that binds its length and type, and refuses one over the limit",
    () =>
      Effect.gen(function* () {
        const world = yield* snapshotWorld();
        const reserved = yield* world.owner.mutation(
          island.mutations.reserveSnapshot,
          { byteSize: PNG.byteLength }
        );
        expect(reserved.address).toContain(
          "X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost"
        );
        const refused = yield* world.owner
          .mutation(island.mutations.reserveSnapshot, {
            byteSize: SNAPSHOT_BYTE_LIMIT + 1,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "SnapshotRefused",
          reason: "size",
        });
        const [key] = yield* keysOf(world);
        expect(key).toMatch(SNAPSHOT_KEY);
      })
  );

  it.effect(
    "shows a visitor no snapshot before the first share, then the newest one at a signed address, deleting the one it replaces",
    () =>
      Effect.gen(function* () {
        const world = yield* snapshotWorld();
        const visit = world.stranger.query(island.queries.visit, {
          username: "nabil",
        });
        expect(yield* visit).not.toHaveProperty("snapshot");
        const first = yield* uploaded(world.owner);
        yield* world.owner.mutation(island.mutations.keepSnapshot, {
          fileId: first,
        });
        yield* world.owner.mutation(island.mutations.keepSnapshot, {
          fileId: first,
        });
        const [firstKey] = yield* keysOf(world);
        expect((yield* visit)?.snapshot).toContain(firstKey);
        const second = yield* uploaded(world.owner);
        yield* world.owner.mutation(island.mutations.keepSnapshot, {
          fileId: second,
        });
        yield* Effect.promise(() =>
          world.t.finishAllScheduledFunctions(vi.runAllTimers)
        );
        const keys = yield* keysOf(world);
        expect(keys).toHaveLength(1);
        expect(keys).not.toContain(firstKey);
        expect((yield* visit)?.snapshot).toContain(keys[0]);
        expect(Rec.keys(bucket.state.objects)).toEqual(keys);
      })
  );

  it.effect(
    "refuses a file of another island and a file that is gone, keeping the island's own snapshot",
    () =>
      Effect.gen(function* () {
        const world = yield* snapshotWorld();
        const theirs = yield* uploaded(world.stranger);
        const refused = yield* world.owner
          .mutation(island.mutations.keepSnapshot, { fileId: theirs })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "SnapshotRefused",
          reason: "file",
        });
        yield* Effect.promise(() =>
          world.t.mutation((ctx) => ctx.db.delete("bucketFiles", theirs))
        );
        const gone = yield* world.owner
          .mutation(island.mutations.keepSnapshot, { fileId: theirs })
          .pipe(Effect.flip);
        expect(gone).toMatchObject({ _tag: "SnapshotRefused", reason: "file" });
        expect(
          yield* world.stranger.query(island.queries.visit, {
            username: "nabil",
          })
        ).not.toHaveProperty("snapshot");
      })
  );

  it.effect(
    "deletes the snapshot with its owner's account, and an island without one alone",
    () =>
      Effect.gen(function* () {
        const world = yield* snapshotWorld();
        const kept = yield* uploaded(world.owner);
        yield* world.owner.mutation(island.mutations.keepSnapshot, {
          fileId: kept,
        });
        yield* world.stranger.mutation(island.mutations.share, {
          visibility: "link",
        });
        const cleanup = (userId: typeof world.ownerId) =>
          Effect.promise(() =>
            world.t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
              userId,
            })
          ).pipe(Effect.repeat({ until: (more) => !more }));
        yield* cleanup(world.ownerId);
        yield* cleanup(world.strangerId);
        yield* Effect.promise(() =>
          world.t.finishAllScheduledFunctions(vi.runAllTimers)
        );
        expect(yield* keysOf(world)).toEqual([]);
        expect(bucket.state.objects).toEqual({});
      })
  );
});
