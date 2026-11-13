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
import {
  AccountDeleted,
  GoogleAddressRefused,
  type GoogleMethod,
  type GoogleProfile,
  SchoolSignUpRefused,
} from "@repo/backend/confect/auth/methods";
import { Clock, Effect, Option } from "effect";

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
