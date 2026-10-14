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
