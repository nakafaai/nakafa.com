import type {
  LoginCardsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { OwnerRole } from "@repo/backend/confect/access/schema";
import { formatCardCode } from "@repo/backend/confect/identity/code";
import {
  drawCardCode,
  hashCardCode,
} from "@repo/backend/confect/identity/secret";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Option,
  Schema,
  Struct,
} from "effect";

/** How long a printed card works, counted from the moment it is issued. */
export const CARD_TERM = Duration.days(14);

/**
 * Why a Person cannot take a login card: an account that a card did not make,
 * or the Owner or Admin role. A card hands the Person's standing grants to
 * whoever redeems it, and a redemption has no signed-in caller who could check
 * a role, so no card goes to either (ADR 0009).
 */
export const CardRefusal = Schema.Literals(["claimed", "role"]);

/** A refusal of one reason, as the card rule answers it. */
const refuse = (reason: typeof CardRefusal.Type) => Option.some(reason);

/**
 * The first reason a Person cannot take a card, or none. Issue, reissue, and
 * redeem all call this one rule, so it has one owner. An account that a card
 * made takes a new card, so a reissued card sets a new password on it. A
 * removed Person is refused by each caller's own status check (ADR 0009).
 */
export const cardRefusalOf = Effect.fn("identity.card.refusal")(function* (
  person: TenantPeopleDoc
) {
  if (person.account.state === "claimed" && person.account.method !== "card") {
    return refuse("claimed");
  }
  const grants = yield* activeGrants(person._id);
  if (Arr.some(grants, (grant) => Schema.is(OwnerRole)(grant.role.key))) {
    return refuse("role");
  }
  return Option.none();
});

/** The card of one Person, if one was ever issued: one indexed read. */
export const cardOf = Effect.fn("identity.card.of")(function* (
  personId: TenantPeopleDoc["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("loginCards")
    .index("by_personId", (query) => query.eq("personId", personId))
    .first()
    .pipe(Effect.orDie);
});

/**
 * Issues the card of one Person. The plain code leaves the server only in the
 * returned value, because only its keyed hash is written. A card that the
 * Person already had is replaced in place, so its old code no longer matches
 * any row, and the card keeps one row per Person.
 */
export const writeCard = Effect.fn("identity.card.write")(function* (
  person: TenantPeopleDoc,
  issuer: TenantPeopleDoc,
  previous: Option.Option<LoginCardsDoc>
) {
  const code = yield* drawCardCode();
  const issuedAt = yield* Clock.currentTimeMillis;
  const fields = {
    codeHash: yield* hashCardCode(code),
    expiresAt: issuedAt + Duration.toMillis(CARD_TERM),
    issuedAt,
    issuedBy: issuer._id,
    personId: person._id,
    tenantId: person.tenantId,
  };
  const writer = yield* DatabaseWriter;
  if (Option.isSome(previous)) {
    yield* writer
      .table("loginCards")
      .replace(previous.value._id, fields)
      .pipe(Effect.orDie);
    return {
      cardId: previous.value._id,
      code: formatCardCode(code),
      expiresAt: fields.expiresAt,
    };
  }
  const cardId = yield* writer
    .table("loginCards")
    .insert(fields)
    .pipe(Effect.orDie);
  return { cardId, code: formatCardCode(code), expiresAt: fields.expiresAt };
});

/** Marks a card redeemed. It stays as the record of the redemption until a new card replaces it. */
export const markRedeemed = Effect.fn("identity.card.redeemed")(function* (
  card: LoginCardsDoc,
  at: number
) {
  yield* (yield* DatabaseWriter)
    .table("loginCards")
    .replace(
      card._id,
      Struct.assign(Struct.omit(card, ["_creationTime", "_id"]), {
        redeemedAt: at,
      })
    )
    .pipe(Effect.orDie);
});
