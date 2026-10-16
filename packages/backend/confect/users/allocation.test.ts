import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  allocateUsername,
  MAX_ALLOCATION_TRIES,
  UsernameExhausted,
} from "@repo/backend/confect/users/allocation";
import {
  isReservedUsername,
  RESERVED_USERNAMES,
} from "@repo/backend/confect/users/reserved";
import { USERNAME_MAX_LENGTH } from "@repo/backend/confect/users/username";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import {
  Array as Arr,
  Cause,
  Effect,
  Exit,
  Random,
  Result,
  Schema,
} from "effect";

const Account = Schema.Struct({
  reads: Schema.Finite,
  username: Schema.String,
});

/** A one letter name that took two random digits. */
const SINGLE_LETTER_RANDOM = /^j[1-9][0-9]$/;

/** A crowded name that took a random number of four digits or more. */
const CROWDED_RANDOM = /^siti[1-9][0-9]{3,}$/;

/**
 * A random source that draws the same fraction every time, so a second draw at
 * the same digit count collides with the first. 0 gives the lowest number of a
 * digit count and 0.5 the middle of it.
 */
const sourceOf = (fraction: number) => ({
  nextDoubleUnsafe: () => fraction,
  nextIntUnsafe: () => 0,
});

/** Inserts the row of an account that holds `username`. */
const insertAccount = Effect.fn("test.insertAccount")(function* (
  index: number,
  name: string,
  username: string
) {
  const ctx = yield* MutationCtx;
  return yield* Effect.promise(() =>
    ctx.db.insert("users", {
      authId: `auth-${index}`,
      credits: 100,
      creditsResetAt: 0,
      email: `account-${index}@example.com`,
      mascot: MASCOT_CODE,
      name,
      plan: "free",
      username,
    })
  );
});

/**
 * Makes accounts of the given names one after another, the way sign-ups do:
 * each takes the username allocated for its name and stores it. Answers each
 * username with the index reads its allocation made.
 */
const signUp = Effect.fn("test.signUp")(function* (names: readonly string[]) {
  const ctx = yield* MutationCtx;
  const query = vi.spyOn(ctx.db, "query");
  return yield* Effect.forEach(names, (name, index) =>
    Effect.gen(function* () {
      const before = query.mock.calls.length;
      const username = yield* allocateUsername(name);
      const reads = query.mock.calls.length - before;
      yield* insertAccount(index, name, username);
      return { reads, username };
    })
  );
});

/**
 * Signs the accounts up in one transaction and answers what each one took and
 * read. The random numbers come from a fixed seed, or from `source`.
 */
const allocate = (
  names: readonly string[],
  source?: ReturnType<typeof sourceOf>
) =>
  Effect.gen(function* () {
    const t = yield* Confect.pipe(Effect.provide(confectLayer));
    const accounts = signUp(names);
    return yield* t.run(
      source === undefined
        ? accounts.pipe(Random.withSeed("allocation"))
        : accounts.pipe(Effect.provideService(Random.Random, source)),
      Schema.mutable(Schema.Array(Account))
    );
  });

const usernamesOf = (accounts: readonly (typeof Account.Type)[]) =>
  Arr.map(accounts, ({ username }) => username);

describe("users/allocation", () => {
  it.effect("makes the username of a name from its letters and digits", () =>
    Effect.gen(function* () {
      expect(
        usernamesOf(
          yield* allocate([
            "Nabil Fatih",
            "Zoë Müller-Lindqvist",
            "Agent 007",
            "3 Musketeers",
          ])
        )
      ).toEqual(["nabilfatih", "zoemullerlindqvist", "agent007", "musketeers"]);
    })
  );

  it.effect("numbers a name that another account already took", () =>
    Effect.gen(function* () {
      expect(
        usernamesOf(
          yield* allocate([
            "Nabil Fatih",
            "Nabil  Fatih",
            "nabil fatih",
            "NABIL",
          ])
        )
      ).toEqual(["nabilfatih", "nabilfatih2", "nabilfatih3", "nabil"]);
    })
  );

  it.effect("keeps the first twenty letters of a long name", () =>
    Effect.gen(function* () {
      expect(
        usernamesOf(
          yield* allocate([
            "Aleksandra Wiśniewska-Kowalczyk",
            "Bartholomew Montgomery Fitzgerald Wellington Carmichael III",
          ])
        )
      ).toEqual(["aleksandrawisniewska", "bartholomewmontgomer"]);
    })
  );

  it.effect("makes room for the number inside twenty characters", () =>
    Effect.gen(function* () {
      const name = "a".repeat(USERNAME_MAX_LENGTH + 5);
      const usernames = usernamesOf(yield* allocate([name, name, name]));
      expect(usernames).toEqual([
        "a".repeat(USERNAME_MAX_LENGTH),
        `${"a".repeat(USERNAME_MAX_LENGTH - 1)}2`,
        `${"a".repeat(USERNAME_MAX_LENGTH - 1)}3`,
      ]);
      expect(Arr.every(usernames, (username) => username.length <= 20)).toBe(
        true
      );
    })
  );

  it.effect("gives a name with no Latin letter the fallback and a number", () =>
    Effect.gen(function* () {
      expect(
        usernamesOf(
          yield* allocate(["田中 さくら", "1234 5678", "", "Привет", "teman"])
        )
      ).toEqual(["teman", "teman2", "teman3", "teman4", "teman5"]);
    })
  );

  it.effect("passes over a candidate that is too short", () =>
    Effect.gen(function* () {
      const [jo, j] = usernamesOf(yield* allocate(["Jo", "J"]));
      expect(jo).toBe("jo2");
      expect(j).toMatch(SINGLE_LETTER_RANDOM);
    })
  );

  it.effect(
    "starts a reserved name from the fallback, never from the name",
    () =>
      Effect.gen(function* () {
        expect(
          usernamesOf(
            yield* allocate([
              "Nakafa",
              "Admin",
              "Nina",
              "School",
              "Pricing",
              "Nakafa",
            ])
          )
        ).toEqual(["teman", "teman2", "teman3", "teman4", "teman5", "teman6"]);
      })
  );

  it.effect("builds no handle on any reserved name", () =>
    Effect.gen(function* () {
      const names = Arr.fromIterable(RESERVED_USERNAMES);
      const usernames = usernamesOf(yield* allocate(names));
      expect(usernames).toHaveLength(names.length);
      expect(
        Arr.every(usernames, (username) => username.startsWith("teman"))
      ).toBe(true);
      expect(
        Arr.some(usernames, (username) => isReservedUsername(username))
      ).toBe(false);
    })
  );

  it.effect(
    "reads one name per try, in order, and then draws a short random number",
    () =>
      Effect.gen(function* () {
        const accounts = yield* allocate(
          Arr.replicate("Siti", 10),
          sourceOf(0.5)
        );
        expect(usernamesOf(Arr.take(accounts, 9))).toEqual([
          "siti",
          "siti2",
          "siti3",
          "siti4",
          "siti5",
          "siti6",
          "siti7",
          "siti8",
          "siti9",
        ]);
        expect(Arr.map(accounts, ({ reads }) => reads)).toEqual([
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        ]);
        // The middle of the two-digit numbers, 10 to 99, is 55.
        expect(usernamesOf(Arr.drop(accounts, 9))).toEqual(["siti55"]);
      })
  );

  it.effect(
    "adds a digit once the random numbers of a digit count collide",
    () =>
      Effect.gen(function* () {
        const accounts = yield* allocate(
          Arr.replicate("Siti", 12),
          sourceOf(0)
        );
        expect(usernamesOf(Arr.drop(accounts, 9))).toEqual([
          "siti10",
          "siti100",
          "siti1000",
        ]);
        expect(Arr.map(Arr.drop(accounts, 9), ({ reads }) => reads)).toEqual([
          10, 12, 14,
        ]);
      })
  );

  it.effect(
    "reads a bounded number of usernames when a thousand accounts share a name",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        // The usernames that one name takes when each account counts up from the one before.
        const crowded = Arr.map(Arr.range(1, 1100), (number) =>
          number === 1 ? "siti" : `siti${number}`
        );
        const account = yield* t.run(
          Effect.gen(function* () {
            yield* Effect.forEach(
              crowded,
              (username, index) => insertAccount(index, "Siti", username),
              { discard: true }
            );
            const [next] = yield* signUp(["Siti"]);
            return next;
          }).pipe(Random.withSeed("crowded")),
          Account
        );

        expect(crowded).not.toContain(account.username);
        expect(account.username).toMatch(CROWDED_RANDOM);
        // Nine names in order and the numbers of two and of three digits that
        // the thousand accounts took are all read before one is free.
        expect(account.reads).toBeGreaterThanOrEqual(14);
        expect(account.reads).toBeLessThanOrEqual(MAX_ALLOCATION_TRIES);
      })
  );

  it.effect(
    "dies with UsernameExhausted once every name it may try is taken",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            // A source that repeats itself gives one name sixteen different tries:
            // nine in order and one at each of seven digit counts.
            yield* signUp(Arr.replicate("Siti", 16));

            const exit = yield* Effect.exit(allocateUsername("Siti"));

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit)) {
              expect(Cause.findDefect(exit.cause)).toEqual(
                Result.succeed(
                  new UsernameExhausted({ tries: MAX_ALLOCATION_TRIES })
                )
              );
            }
          }).pipe(Effect.provideService(Random.Random, sourceOf(0)))
        );
      })
  );
});
