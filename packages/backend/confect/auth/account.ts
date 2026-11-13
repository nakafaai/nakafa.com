import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { DatabaseReader, DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
} from "@repo/backend/confect/credits/constants";
import { getCurrentCreditResetTimestamp } from "@repo/backend/confect/credits/state";
import { declareWelcomeIntent } from "@repo/backend/confect/emails/welcome/impl";
import { claimAfterVerification } from "@repo/backend/confect/tenancy/claims";
import { claimGuardianPersons } from "@repo/backend/confect/guardians/claim";
import { allocateUsername } from "@repo/backend/confect/users/allocation";
import { accountMascot } from "@repo/backend/confect/users/mascot";
import { Clock, Effect, Option, Schema } from "effect";

/**
 * The account profile that Convex Auth's Google method passes to Nakafa's user
 * callbacks, field for field (`vGoogleProfile`). `id` is Google's `sub`.
 * https://docs.convex.dev/auth/convex-auth/methods/oauth
 */
export const GoogleProfile = Schema.Struct({
  id: Schema.String,
  email: Schema.optionalKey(Schema.String),
  emailVerified: Schema.Boolean,
  name: Schema.optionalKey(Schema.String),
  picture: Schema.optionalKey(Schema.String),
});

/** The Google method as Convex Auth names it to the user callbacks. */
export const GoogleMethod = Schema.Struct({
  name: Schema.Literal("google"),
  profile: GoogleProfile,
});

/** The username and password method as Convex Auth names it to the user callbacks. */
export const SchoolMethod = Schema.Struct({
  name: Schema.Literal("usernamePassword"),
  profile: Schema.Struct({}),
});

/**
 * Google gave no address for the account, or one it did not verify. Every
 * Nakafa address with a mailbox is one Google verified, which billing and
 * school invites rely on, so no account is made or found without one.
 */
export class GoogleAddressRefused extends Schema.TaggedError<
  GoogleAddressRefused,
  { readonly brand: unique symbol }
>()("GoogleAddressRefused", {
  code: Schema.Literals(["GOOGLE_ADDRESS_MISSING", "GOOGLE_ADDRESS_UNVERIFIED"]),
  message: Schema.String,
}) {}

/**
 * The account that a sign-in names is deleted. Convex Auth keeps the Google
 * account linked to the deleted account's id, so that Google account cannot
 * sign in again.
 */
export class AccountDeleted extends Schema.TaggedError<
  AccountDeleted,
  { readonly brand: unique symbol }
>()("AccountDeleted", {
  code: Schema.Literal("ACCOUNT_DELETED"),
  message: Schema.String,
}) {}

/** Nobody signs up with a password: the school makes every school account (ADR 0009). */
export class SchoolSignUpRefused extends Schema.TaggedError<
  SchoolSignUpRefused,
  { readonly brand: unique symbol }
>()("SchoolSignUpRefused", {
  code: Schema.Literal("SCHOOL_SIGN_UP_REFUSED"),
  message: Schema.String,
}) {}

/**
 * The live account that holds an address, if any. A deleted account keeps a
 * placeholder address (`deletion/tombstone`), so it never holds a real one.
 */
const readAccountOf = Effect.fn("auth.account.read")(function* (
  email: string
) {
  const account = yield* (yield* DatabaseReader)
    .table("users")
    .index("by_email", (query) => query.eq("email", email))
    .first()
    .pipe(Effect.orDie);
  return Option.filter(account, (user) => user.deletedAt === undefined);
});

/**
 * Writes the row of a new Nakafa account: its animal from `seed`, a username
 * allocated from its name, and the plan's credits. Google sign-ins and school
 * cards both make accounts through this one write.
 */
export const insertAccount = Effect.fn("auth.account.insert")(function* (input: {
  readonly email: string;
  readonly image?: string;
  readonly name: string;
  readonly seed: string;
}) {
  const now = yield* Clock.currentTimeMillis;
  return yield* (yield* DatabaseWriter)
    .table("users")
    .insert({
      email: input.email,
      mascot: accountMascot(input.seed),
      name: input.name,
      username: yield* allocateUsername(input.name),
      ...(input.image === undefined ? {} : { image: input.image }),
      plan: DEFAULT_USER_PLAN,
      credits: DEFAULT_USER_CREDITS,
      creditsResetAt: getCurrentCreditResetTimestamp(DEFAULT_USER_PLAN, now),
    })
    .pipe(Effect.orDie);
});

/**
 * Makes the Nakafa account of a new Google identity, and asks for the welcome
 * email and the claim of any invite that waits for its verified address
 * (ADR 0009).
 */
const makeAccount = Effect.fn("auth.account.make")(function* (
  profile: typeof GoogleProfile.Type,
  email: string
) {
  const userId = yield* insertAccount({
    email,
    ...(profile.picture === undefined ? {} : { image: profile.picture }),
    name: profile.name ?? email,
    seed: profile.id,
  });
  yield* declareWelcomeIntent(userId);
  yield* claimAfterVerification(userId, email);
  return userId;
});

/**
 * The account of a Google identity that Convex Auth has not seen yet. The
 * account that holds the address Google verified is the person's own, so every
 * learner keeps their account, their data and their id; any other identity gets
 * a new account.
 */
export const createGoogleAccount = Effect.fn("auth.account.createGoogle")(
  function* ({ method }: { readonly method: typeof GoogleMethod.Type }) {
    const { profile } = method;
    if (profile.email === undefined) {
      return yield* new GoogleAddressRefused({
        code: "GOOGLE_ADDRESS_MISSING",
        message: "Google gave no email address for this account.",
      });
    }
    if (!profile.emailVerified) {
      return yield* new GoogleAddressRefused({
        code: "GOOGLE_ADDRESS_UNVERIFIED",
        message: "Verify this email address with Google first.",
      });
    }
    const email = profile.email.toLowerCase();
    const linked = yield* readAccountOf(email);
    if (Option.isSome(linked)) {
      return linked.value._id;
    }
    return yield* makeAccount(profile, email);
  }
);

/**
 * Refuses the sign-in of a deleted account, and claims the guardian Persons that
 * the school linked to the account's verified address (ADR 0034). Every sign-in
 * runs this, the first one included, so a Google identity linked to a deleted
 * account cannot start a session.
 */
export const admitGoogleSignIn = Effect.fn("auth.account.signInGoogle")(
  function* ({ userId }: { readonly userId: Id<"users"> }) {
    const account = yield* (yield* DatabaseReader)
      .table("users")
      .get(userId)
      .pipe(Effect.option);
    if (Option.isNone(account) || account.value.deletedAt !== undefined) {
      return yield* new AccountDeleted({
        code: "ACCOUNT_DELETED",
        message: "This Google account belonged to a deleted Nakafa account.",
      });
    }
    yield* claimGuardianPersons(userId, account.value.email);
    return null;
  }
);

/** The password method's sign-up, which Nakafa never exports, refuses anyway. */
export const refuseSchoolSignUp = Effect.fn("auth.account.createSchool")(
  function* () {
    return yield* new SchoolSignUpRefused({
      code: "SCHOOL_SIGN_UP_REFUSED",
      message: "A school makes every school account.",
    });
  }
);
