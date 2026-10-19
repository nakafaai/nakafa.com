import { Effect, Schema } from "effect";

/** Why a school login name cannot be used: a character that is not allowed, a length, or a reserved name. */
export const LoginNameRefusal = Schema.Literals([
  "characters",
  "length",
  "reserved",
]);

/** A school login name that the school cannot use. The reason tells the form which fix to show. */
export class LoginNameRefused extends Schema.TaggedError<LoginNameRefused>()(
  "LoginNameRefused",
  {
    code: Schema.Literal("LOGIN_NAME_REFUSED").pipe(
      Schema.withConstructorDefault(Effect.succeed("LOGIN_NAME_REFUSED"))
    ),
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed("This login name cannot be used.")
      )
    ),
    reason: LoginNameRefusal,
  }
) {}

/** Another Person of the same school already holds this login name, compared without case. */
export class LoginNameTaken extends Schema.TaggedError<LoginNameTaken>()(
  "LoginNameTaken",
  {
    code: Schema.Literal("LOGIN_NAME_TAKEN").pipe(
      Schema.withConstructorDefault(Effect.succeed("LOGIN_NAME_TAKEN"))
    ),
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed("Another person of this school has this login name.")
      )
    ),
  }
) {}

/** Issuing a first card for a Person who already has a login name. Reissue prints the next card instead. */
export class LoginExists extends Schema.TaggedError<LoginExists>()(
  "LoginExists",
  {
    code: Schema.Literal("LOGIN_EXISTS").pipe(
      Schema.withConstructorDefault(Effect.succeed("LOGIN_EXISTS"))
    ),
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed("This person already has a login name.")
      )
    ),
  }
) {}

/** Reissuing a card for a Person who has no login name yet. Issue creates the name first. */
export class LoginMissing extends Schema.TaggedError<LoginMissing>()(
  "LoginMissing",
  {
    code: Schema.Literal("LOGIN_MISSING").pipe(
      Schema.withConstructorDefault(Effect.succeed("LOGIN_MISSING"))
    ),
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed("This person has no login name yet.")
      )
    ),
  }
) {}

/** Printing a card for a Person who holds no login card, so there is no card to print. */
export class CardMissing extends Schema.TaggedError<CardMissing>()(
  "CardMissing",
  {
    code: Schema.Literal("CARD_MISSING").pipe(
      Schema.withConstructorDefault(Effect.succeed("CARD_MISSING"))
    ),
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed("This person has no login card to print.")
      )
    ),
  }
) {}

/** Issuing or reissuing a card for a Person who holds the Owner or Admin role. No card goes to such a Person (ADR 0009). */
export class CardRoleRefused extends Schema.TaggedError<CardRoleRefused>()(
  "CardRoleRefused",
  {
    code: Schema.Literal("CARD_ROLE_REFUSED").pipe(
      Schema.withConstructorDefault(Effect.succeed("CARD_ROLE_REFUSED"))
    ),
    message: Schema.String.pipe(
      Schema.withConstructorDefault(
        Effect.succeed(
          "A login card cannot be given to a person who holds the Owner or Admin role."
        )
      )
    ),
  }
) {}
