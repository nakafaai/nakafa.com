import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import {
  Auth as ConvexAuth,
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { type Auth, createAuth } from "@repo/backend/confect/auth/runtime";
import {
  createLoginAccount,
  setLoginPassword,
} from "@repo/backend/confect/identity/account";
import {
  cardRefusalOf,
  markRedeemed,
} from "@repo/backend/confect/identity/card";
import {
  hashCardCode,
  readCardCode,
} from "@repo/backend/confect/identity/code";
import { loginOf, readLoginName } from "@repo/backend/confect/identity/logins";
import type {
  RedeemOutcome,
  RedeemRefusal,
  RedeemRequest,
} from "@repo/backend/confect/identity/schema";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { bindPerson } from "@repo/backend/confect/tenancy/claim";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Clock, Effect, Option, Result } from "effect";

/**
 * Attempts one device may make: five at once, then five more each fifteen
 * minutes. The code's 50 bits are the protection against guessing (ADR 0009), and
 * this bucket only slows one browser: the device is a UUID that the sign-in page
 * keeps, so a device that asks for a new one gets a new bucket. A bucket shared by
 * every device would let one person block another's card, so the limit stays per
 * device.
 */
const DEVICE_ATTEMPTS = { capacity: 5, period: 15 * MINUTE, rate: 5 };

const attempts = new RateLimiter(components.agentRateLimiter, {
  cardRedeemByDevice: { ...DEVICE_ATTEMPTS, kind: "token bucket" },
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

/** Counts one attempt from one device against its limit, and says whether the attempt may go on. */
const admit = Effect.fn("identity.redeem.admit")(function* (
  ctx: MutationCtx,
  device: string
) {
  const quota = yield* Effect.tryPromise(() =>
    attempts.limit(ctx, "cardRedeemByDevice", { key: device })
  ).pipe(Effect.orDie);
  return quota.ok;
});

/**
 * Whether the request carries an authenticated identity. A card is redeemed only
 * from a signed-out device, so a request that carries one is refused (ADR 0009).
 */
const isSignedIn = Effect.fn("identity.redeem.signedIn")(function* () {
  const identity = yield* (yield* ConvexAuth).getUserIdentity.pipe(
    Effect.asSome,
    Effect.catchTag("NoUserIdentityFoundError", () => Effect.succeedNone)
  );
  return Option.isSome(identity);
});

/**
 * The card that a code opens on this school's host, when the card can still be
 * redeemed. A code of another school, an unknown code, a suspended school, and
 * a removed Person all read as `invalid`, and so does a Person the card rule
 * refuses, so the answer tells a guesser nothing about which part was right. The
 * Person is read before the card's state, so a used or expired card of such a
 * Person reads as `invalid` too. A used card and an expired one are told apart.
 * A login name that is not the card's own also reads as `invalid`, and it is
 * checked before the card's state, so a wrong name learns nothing about the card.
 */
const findRedeemable = Effect.fn("identity.redeem.find")(function* (
  slug: TenantSlug,
  code: string,
  loginName: string
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
  const person = yield* reader
    .table("tenantPeople")
    .get(card.value.personId)
    .pipe(Effect.orDie);
  if (
    person.status !== "active" ||
    Option.isSome(yield* cardRefusalOf(person))
  ) {
    return reject("invalid");
  }
  // Issuing writes the login before the card, and nothing deletes a login, so a
  // card without one is a broken row: the defect rolls the redemption back.
  const login = yield* Effect.fromOption(yield* loginOf(person._id)).pipe(
    Effect.orDie
  );
  if (login.name !== loginName) {
    return reject("invalid");
  }
  if (card.value.redeemedAt !== undefined) {
    return reject("used");
  }
  if (card.value.expiresAt <= (yield* Clock.currentTimeMillis)) {
    return reject("expired");
  }
  return Result.succeed({ card: card.value, login, person });
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
 * a reissued card allows. In order, it refuses a request that carries a signed-in
 * identity before any limit is spent, counts the attempt against its device's bucket
 * (which only slows one browser), reads the code and the typed login name, opens the
 * card on the school's host with that login name, checks the password length,
 * creates the account if the Person has none and claims the Person, stores the
 * password through Better Auth, marks the card used, and journals the redemption.
 * The rate-limit count is written first, on purpose: a refusal is a value, so the
 * attempt it refuses still counts. The account, claim, password, and card writes
 * come after the last refusal, so a refused card changes nothing else.
 */
export const redeemCard = Effect.fn("identity.redeem.card")(function* (
  input: typeof RedeemRequest.Type
) {
  if (yield* isSignedIn()) {
    return refused("invalid");
  }
  const ctx = yield* MutationCtx;
  if (!(yield* admit(ctx, input.deviceId))) {
    return refused("rateLimited");
  }
  const code = readCardCode(input.code);
  const loginName = readLoginName(input.loginName);
  if (Option.isNone(code) || Result.isFailure(loginName)) {
    return refused("invalid");
  }
  const found = yield* findRedeemable(
    input.slug,
    code.value,
    loginName.success
  );
  if (Result.isFailure(found)) {
    return refused(found.failure);
  }
  const { card, login, person } = found.success;
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
    type: "card.redeemed",
  });
  return redeemed(login.name);
});
