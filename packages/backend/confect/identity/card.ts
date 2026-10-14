import type {
  LoginCardsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  drawCardCode,
  formatCardCode,
  hashCardCode,
} from "@repo/backend/confect/identity/code";
import { Clock, Duration, Effect, Option, Struct } from "effect";

/** How long a printed card works, counted from the moment it is issued. */
export const CARD_TERM = Duration.days(14);

/** The card of one Person, if one was ever issued: one indexed read. */
export const cardOf = Effect.fn("identity.card.of")(function* (
  personId: TenantPeopleDoc["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("loginCards")
    .get("by_personId", personId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
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
