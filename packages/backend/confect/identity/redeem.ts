import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { type Auth, createAuth } from "@repo/backend/confect/auth/runtime";
import {
  createLoginAccount,
  setLoginPassword,
} from "@repo/backend/confect/identity/account";
import { markRedeemed, takesCard } from "@repo/backend/confect/identity/card";
import {
  hashCardCode,
  readCardCode,
} from "@repo/backend/confect/identity/code";
import { loginOf } from "@repo/backend/confect/identity/logins";
import type {
  RedeemOutcome,
  RedeemRefusal,
  RedeemRequest,
} from "@repo/backend/confect/identity/schema";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { bindPerson } from "@repo/backend/confect/tenancy/claim";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Clock, Effect, Option, pipe, Result, String as Str } from "effect";

/**
 * Attempts one device may make: five at once, then five more each fifteen
 * minutes. The device is a UUID that the sign-in page keeps, so this limit alone
 * does not stop a device that asks for a new one.
 */
const DEVICE_ATTEMPTS = { capacity: 5, period: 15 * MINUTE, rate: 5 };
/**
 * Attempts one code prefix may take in an hour, from every device together.
 * It holds whatever device a guesser claims, so it is the limit that holds.
 */
const PREFIX_ATTEMPTS = { capacity: 10, period: HOUR, rate: 10 };
/** The characters that name a code's prefix: its first group of five. */
const PREFIX_LENGTH = 5;

const attempts = new RateLimiter(components.agentRateLimiter, {
  cardRedeemByDevice: { ...DEVICE_ATTEMPTS, kind: "token bucket" },
  cardRedeemByPrefix: { ...PREFIX_ATTEMPTS, kind: "token bucket" },
});

/** A refusal, as the outcome that the page reads. */
const refused = (
  reason: typeof RedeemRefusal.Type
): typeof RedeemOutcome.Type => ({ outcome: "refused", reason });

/** The outcome of a redeem that stored the password. */
const redeemed = (loginName: string): typeof RedeemOutcome.Type => ({
  loginName,
  outcome: "redeemed",
});

/** A reason that a card cannot be redeemed, as a failed result. */
const reject = (reason: typeof RedeemRefusal.Type) => Result.fail(reason);

/** Counts one attempt against one limit, and says whether the attempt may go on. */
const admit = Effect.fn("identity.redeem.admit")(function* (
  ctx: MutationCtx,
  name: "cardRedeemByDevice" | "cardRedeemByPrefix",
  key: string
) {
  const quota = yield* Effect.tryPromise(() =>
    attempts.limit(ctx, name, { key })
  ).pipe(Effect.orDie);
  return quota.ok;
});

/** The first characters of what was typed, without spaces or dashes: the key of the prefix limit. */
const prefixOf = (input: string) =>
  pipe(
    input,
    Str.toUpperCase,
    Str.replaceAll(/[\s-]/gu, ""),
    Str.takeLeft(PREFIX_LENGTH)
  );

/**
 * The card that a code opens on this school's host, when the card can still be
 * redeemed. A code of another school, an unknown code, a suspended school, and
 * a removed Person all read as `invalid`, so the answer tells a guesser nothing
 * about which part was right. A used card and an expired one are told apart.
 */
const findRedeemable = Effect.fn("identity.redeem.find")(function* (
  slug: TenantSlug,
  code: string
) {
  const reader = yield* DatabaseReader;
  const tenant = yield* reader
    .table("tenants")
    .get("by_slug", slug)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  const card = yield* reader
    .table("loginCards")
    .get("by_codeHash", yield* hashCardCode(code))
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  if (
    Option.isNone(tenant) ||
    Option.isNone(card) ||
    card.value.tenantId !== tenant.value._id ||
    tenant.value.status !== "active"
  ) {
    return reject("invalid");
  }
  if (card.value.redeemedAt !== undefined) {
    return reject("used");
  }
  if (card.value.expiresAt <= (yield* Clock.currentTimeMillis)) {
    return reject("expired");
  }
  const person = yield* reader
    .table("tenantPeople")
    .get(card.value.personId)
    .pipe(Effect.orDie);
  if (person.status !== "active" || !takesCard(person)) {
    return reject("invalid");
  }
  return Result.succeed({ card: card.value, person });
});

/**
 * The Better Auth account of a Person, made first when the Person has none. A
 * new account is bound to the Person as a card claim in the same transaction,
 * so a password step that fails later rolls the claim back with it. A Person
 * that already has an account holds one that a card made, because
 * `findRedeemable` refuses any other, so a reissued card reuses that account.
 */
const accountOf = Effect.fn("identity.redeem.account")(function* (
  auth: Auth,
  person: TenantPeopleDoc
) {
  if (person.account.state === "claimed") {
    const user = yield* (yield* DatabaseReader)
      .table("users")
      .get(person.account.userId)
      .pipe(Effect.orDie);
    return { authId: user.authId };
  }
  const created = yield* createLoginAccount(auth, person.name);
  yield* bindPerson(person, {
    claimedAt: yield* Clock.currentTimeMillis,
    method: "card",
    state: "claimed",
    userId: created.userId,
  });
  yield* personAuthority.record(personActor(person), person, {
    method: "card",
    type: "person.claimed",
  });
  return { authId: created.authId };
});

/**
 * Redeems one login card: the student's first sign-in, or the new password that
 * a reissued card allows. In order, it counts the attempt against the rate
 * limits, reads the code, opens the card on the school's host, checks the
 * password length, creates the account if the Person has none and claims the
 * Person, stores the password through Better Auth, and marks the card used.
 * The rate-limit counts are written first, on purpose: a refusal is a value, so
 * the attempt it refuses still counts. The account, claim, password, and card
 * writes come after the last refusal, so a refused card changes nothing else.
 */
export const redeemCard = Effect.fn("identity.redeem.card")(function* (
  input: typeof RedeemRequest.Type
) {
  const ctx = yield* MutationCtx;
  const [byDevice, byPrefix] = yield* Effect.all([
    admit(ctx, "cardRedeemByDevice", input.deviceId),
    admit(ctx, "cardRedeemByPrefix", prefixOf(input.code)),
  ]);
  if (!(byDevice && byPrefix)) {
    return refused("rateLimited");
  }
  const code = readCardCode(input.code);
  if (Option.isNone(code)) {
    return refused("invalid");
  }
  const found = yield* findRedeemable(input.slug, code.value);
  if (Result.isFailure(found)) {
    return refused(found.failure);
  }
  const { card, person } = found.success;
  // Issuing writes the login before the card, and nothing deletes a login, so a
  // card without one is a broken row: the defect rolls the redemption back.
  const login = yield* Effect.fromOption(yield* loginOf(person._id)).pipe(
    Effect.orDie
  );
  // A missing site or Google setting is a deployment defect, not a refusal.
  const auth = yield* createAuth(ctx).pipe(Effect.orDie);
  const context = yield* Effect.promise(() => auth.$context);
  const { maxPasswordLength, minPasswordLength } = context.password.config;
  if (input.password.length < minPasswordLength) {
    return refused("passwordTooShort");
  }
  if (input.password.length > maxPasswordLength) {
    return refused("passwordTooLong");
  }
  const account = yield* accountOf(auth, person);
  yield* setLoginPassword(auth, account.authId, input.password);
  yield* markRedeemed(card, yield* Clock.currentTimeMillis);
  yield* personAuthority.record(personActor(person), person, {
    card: card._id,
    type: "login.card.redeemed",
  });
  return redeemed(login.name);
});
