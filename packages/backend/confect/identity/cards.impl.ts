import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { authorizeOwnerRole } from "@repo/backend/confect/access/grant";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { cardOf, writeCard } from "@repo/backend/confect/identity/card";
import spec from "@repo/backend/confect/identity/cards.spec";
import {
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
import { Effect, Layer, Option, Result } from "effect";

/**
 * A card hands the Person's standing grants to whoever signs in with it, so a
 * Person who holds an Owner or Admin role may only get a card from someone who
 * holds `owner.manage` (ADR 0011, ADR 0012).
 */
const authorizeHeldRoles = Effect.fn("identity.cards.heldRoles")(function* (
  personId: TenantPeopleDoc["_id"]
) {
  const grants = yield* activeGrants(personId);
  yield* Effect.forEach(grants, (grant) => authorizeOwnerRole(grant.role.key), {
    discard: true,
  });
});

/**
 * Gives a Person their school login name and prints their first card. A card
 * that the Person already had is replaced, so its code stops working.
 */
const issue = FunctionImpl.make(
  databaseSchema,
  spec,
  "issue",
  Effect.fn("identity.cards.issue")(function* ({ loginName }) {
    const { person: issuer } = yield* Member;
    const person = yield* Person;
    yield* authorizeHeldRoles(person._id);
    const name = readLoginName(loginName);
    if (Result.isFailure(name)) {
      return yield* new LoginNameRefused({ reason: name.failure });
    }
    yield* claimLoginName(person, name.success);
    const card = yield* writeCard(person, issuer, yield* cardOf(person._id));
    yield* personAuthority.record(personActor(issuer), person, {
      card: card.cardId,
      type: "login.card.issued",
    });
    return {
      code: card.code,
      expiresAt: card.expiresAt,
      loginName: name.success,
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
    yield* authorizeHeldRoles(person._id);
    const login = yield* loginOf(person._id);
    if (Option.isNone(login)) {
      return yield* new LoginMissing();
    }
    const card = yield* writeCard(person, issuer, yield* cardOf(person._id));
    yield* personAuthority.record(personActor(issuer), person, {
      card: card.cardId,
      type: "login.card.reissued",
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
  Layer.provide(issue),
  Layer.provide(reissue),
  Layer.provide(redeem),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(personAccess),
  GroupImpl.finalize
);
