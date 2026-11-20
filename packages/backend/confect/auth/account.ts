import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type {
  GoogleMethod,
  GoogleProfile,
} from "@repo/backend/confect/auth/methods";
import {
  AccountDeleted,
  GoogleAddressRefused,
  SchoolSignUpRefused,
} from "@repo/backend/confect/auth/methods";
import {
  DEFAULT_USER_CREDITS,
  DEFAULT_USER_PLAN,
} from "@repo/backend/confect/credits/constants";
import { getCurrentCreditResetTimestamp } from "@repo/backend/confect/credits/state";
import { declareWelcomeIntent } from "@repo/backend/confect/emails/welcome/impl";
import { claimGuardianPersons } from "@repo/backend/confect/guardians/claim";
import { claimAfterVerification } from "@repo/backend/confect/tenancy/claims";
import { allocateUsername } from "@repo/backend/confect/users/allocation";
import { accountMascot } from "@repo/backend/confect/users/mascot";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Clock, Effect, Option, String as Str } from "effect";

/**
 * The live account that holds an address, if any. A deleted account keeps a
 * placeholder address (`deletion/tombstone`), so it never holds a real one.
 */
const readAccountOf = Effect.fn("auth.account.read")(function* (email: string) {
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
export const insertAccount = Effect.fn("auth.account.insert")(
  function* (input: {
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
  }
);

/**
 * Makes the Nakafa account of a new Google identity and asks for its welcome
 * email (ADR 0009). The sign-in that follows in the same transaction records the
 * identity and asks for the claim of any invite that waits for its address.
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
 * Records the Google identity of a sign-in with the hosted domain it carried,
 * lowercase, and answers whether the row is new or changed: a new identity, a
 * new hosted domain, or a personal account that lost one. An identity reads one
 * row by its subject, so a sign-in costs one indexed read and at most one write.
 */
const recordGoogleAccount = Effect.fn("auth.account.recordGoogle")(function* (
  userId: Id<"users">,
  profile: typeof GoogleProfile.Type
) {
  const hostedDomain = Option.map(
    Option.fromUndefinedOr(profile.hostedDomain),
    Str.toLowerCase
  );
  const row = {
    subject: profile.id,
    userId,
    ...Option.match(hostedDomain, {
      onNone: () => ({}),
      onSome: (domain) => ({ hostedDomain: domain }),
    }),
  };
  const stored = yield* (yield* DatabaseReader)
    .table("googleAccounts")
    .index("by_subject", (query) => query.eq("subject", profile.id))
    .first()
    .pipe(Effect.orDie);
  const writer = (yield* DatabaseWriter).table("googleAccounts");
  if (Option.isNone(stored)) {
    yield* writer.insert(row).pipe(Effect.orDie);
    return true;
  }
  if (
    stored.value.userId === userId &&
    stored.value.hostedDomain === row.hostedDomain
  ) {
    return false;
  }
  yield* writer.replace(stored.value._id, row).pipe(Effect.orDie);
  return true;
});

/**
 * Refuses the sign-in of a deleted account, records the Google identity with
 * its hosted domain, and claims the guardian Persons that the school linked to
 * the account's verified address (ADR 0034). Every sign-in runs this, the first
 * one included, so a Google identity linked to a deleted account cannot start a
 * session. A new identity or a new hosted domain asks for the claim of the
 * invites that wait for the address, since a school's email domains admit an
 * invite by the hosted domains of the account's Google sign-ins (ADR 0011).
 */
export const admitGoogleSignIn = Effect.fn("auth.account.signInGoogle")(
  function* ({
    method,
    userId,
  }: {
    readonly method: typeof GoogleMethod.Type;
    readonly userId: Id<"users">;
  }) {
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
    if (yield* recordGoogleAccount(userId, method.profile)) {
      yield* claimAfterVerification(userId, account.value.email);
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
