import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import {
  type CardRefusal,
  cardOf,
  cardRefusalOf,
  writeCard,
} from "@repo/backend/confect/identity/card";
import spec from "@repo/backend/confect/identity/cards.spec";
import {
  CardRoleRefused,
  LoginMissing,
  LoginNameRefused,
} from "@repo/backend/confect/identity/errors";
import {
  claimLoginName,
  loginOf,
  readLoginName,
} from "@repo/backend/confect/identity/logins";
import { redeemCard } from "@repo/backend/confect/identity/redeem";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Person } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  personAccess,
  personAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { createPerson } from "@repo/backend/confect/tenancy/create";
import { PersonClaimed } from "@repo/backend/confect/tenancy/errors";
import { Effect, Layer, Match, Option, Result } from "effect";

/**
 * The error that a Person the card rule refuses answers with: a role that no
 * card may hand over, or an account that a card did not make.
 */
const refusalError = (refusal: typeof CardRefusal.Type) =>
  Match.value(refusal).pipe(
    Match.when("role", () => new CardRoleRefused()),
    Match.when("claimed", () => new PersonClaimed()),
    Match.exhaustive
  );

/**
 * Gives a Person their school login name and prints their first card. Only a
 * Person with no account yet may take one, the same rule an invite follows, so
 * a card never sets a password on an account that an invite claimed. A Person
 * who holds the Owner or Admin role gets none. A Person who already has a login
 * gets a new card from `reissue`.
 */
const issue = FunctionImpl.make(
  databaseSchema,
  spec,
  "issue",
  Effect.fn("identity.cards.issue")(function* ({ loginName }) {
    const { person: issuer } = yield* Member;
    const person = yield* Person;
    const refusal = yield* cardRefusalOf(person);
    if (Option.isSome(refusal)) {
      return yield* refusalError(refusal.value);
    }
    const name = readLoginName(loginName);
    if (Result.isFailure(name)) {
      return yield* new LoginNameRefused({ reason: name.failure });
    }
    yield* claimLoginName(person, name.success);
    const card = yield* writeCard(person, issuer, Option.none());
    yield* personAuthority.record(personActor(issuer), person, {
      card: card.cardId,
      type: "card.issued",
    });
    return {
      code: card.code,
      expiresAt: card.expiresAt,
      loginName: name.success,
    };
  })
);

/**
 * Adds a student in one transaction: an unclaimed Person, the school login name, and
 * the first card. A login name the school cannot use refuses the step before anything
 * is written, and a name taken at the claim refuses the whole transaction, so no Person
 * is left without its card.
 */
const enroll = FunctionImpl.make(
  databaseSchema,
  spec,
  "enroll",
  Effect.fn("identity.cards.enroll")(function* ({ loginName, name }) {
    const { person: issuer, tenant } = yield* Member;
    const login = readLoginName(loginName);
    if (Result.isFailure(login)) {
      return yield* new LoginNameRefused({ reason: login.failure });
    }
    const by = personActor(issuer);
    const person = yield* createPerson(by, tenant._id, name);
    yield* personAuthority.check("card.issue", person);
    yield* claimLoginName(person, login.success);
    const card = yield* writeCard(person, issuer, Option.none());
    yield* personAuthority.record(by, person, {
      card: card.cardId,
      type: "card.issued",
    });
    return {
      code: card.code,
      expiresAt: card.expiresAt,
      loginName: login.success,
    };
  })
);

/**
 * Prints a new card for a Person who already has a login name, such as a
 * student who lost the card or a teacher who forgot the password. The old code
 * stops working, and the login name stays the same.
 */
const reissue = FunctionImpl.make(
  databaseSchema,
  spec,
  "reissue",
  Effect.fn("identity.cards.reissue")(function* () {
    const { person: issuer } = yield* Member;
    const person = yield* Person;
    const refusal = yield* cardRefusalOf(person);
    if (Option.isSome(refusal)) {
      return yield* refusalError(refusal.value);
    }
    const login = yield* loginOf(person._id);
    if (Option.isNone(login)) {
      return yield* new LoginMissing();
    }
    const card = yield* writeCard(person, issuer, yield* cardOf(person._id));
    yield* personAuthority.record(personActor(issuer), person, {
      card: card.cardId,
      type: "card.reissued",
    });
    return {
      code: card.code,
      expiresAt: card.expiresAt,
      loginName: login.value.name,
    };
  })
);

/** Redeems a card on the school's host: the student's first sign-in or a new password. */
const redeem = FunctionImpl.make(
  databaseSchema,
  spec,
  "redeem",
  Effect.fn("identity.cards.redeem")(function* (args) {
    return yield* redeemCard(args);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(enroll),
  Layer.provide(issue),
  Layer.provide(reissue),
  Layer.provide(redeem),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  Layer.provide(personAccess),
  GroupImpl.finalize
);
