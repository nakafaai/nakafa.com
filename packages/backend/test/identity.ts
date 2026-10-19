import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { createAuth } from "@repo/backend/confect/auth/runtime";
import { slugOf, type tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

/** The moment the card tests start from. Fake timers hold the clock here. */
export const CARD_NOW = Date.UTC(2026, 9, 14, 9, 0, 0);
/** A printed code: two groups of five characters of the Crockford alphabet. */
export const CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/;
/** A device the sign-in page keeps, as a UUID. */
export const DEVICE = "0f8fad5b-d9cb-4691-a165-8c45a5d2a1e1";
export const PASSWORD = "correct horse battery";
/** A code no card holds, with the dash the page sends. */
export const UNKNOWN_CODE = "ABCDE-FGHJK";
/** The school login name that the fixture's card is issued with, and that a student types. */
export const LOGIN_NAME = "guru.baru";
export const { issue, redeem, reissue } = refs.public.identity.cards;
export const nf = slugOf("nf");
export const other = slugOf("other");

type CardFixture = Effect.Success<typeof tenancyFixture>;

/** Issues the first card of the fixture's unclaimed Person, as its school's Admin. */
export const issueFirst = (fixture: CardFixture, loginName = LOGIN_NAME) =>
  fixture.as("admin").mutation(issue, {
    loginName,
    personId: fixture.invited,
    slug: nf,
  });

/**
 * Redeems one code on a school's host, from one device, as a visitor who has no account. The
 * student types the login name of the card, which is `LOGIN_NAME` unless a test says another.
 */
export const redeemOn = (
  fixture: CardFixture,
  code: string,
  password = PASSWORD,
  deviceId = DEVICE,
  slug = nf,
  loginName = LOGIN_NAME
) =>
  fixture.anonymous.mutation(redeem, {
    code,
    deviceId,
    loginName,
    password,
    slug,
  });

/** The Person of the fixture's unclaimed invitee, as stored. */
export const inviteePerson = (fixture: CardFixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("tenantPeople").get(fixture.invited).pipe(Effect.orDie)
    )
  );

/**
 * Binds the fixture's unclaimed invitee to a stranger's account by an invite,
 * the way an accepted invite does after the card was printed.
 */
export const claimInviteeByInvite = (fixture: CardFixture) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("tenantPeople").patch(fixture.invited, {
        account: {
          claimedAt: CARD_NOW,
          method: "invite",
          state: "claimed",
          userId: fixture.users.stranger.userId,
        },
      })
    )
  );

/** The app user with a global username, if one exists. */
export const userNamed = (fixture: CardFixture, username: string) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("users")
        .index("by_username", (query) => query.eq("username", username))
        .first()
        .pipe(Effect.orDie)
    )
  );

/** The card row of one Person, if one exists. */
export const cardRowOf = (
  fixture: CardFixture,
  personId: CardFixture["invited"]
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("loginCards")
        .index("by_personId", (query) => query.eq("personId", personId))
        .first()
        .pipe(Effect.orDie)
    )
  );

/**
 * Whether the invitee's stored password is `password`, checked the way Better
 * Auth checks a password at sign-in, so a test reads the stored credential.
 */
export const storedPasswordIs = (fixture: CardFixture, password: string) =>
  fixture.run(
    Effect.gen(function* () {
      const reader = yield* DatabaseReader;
      const person = yield* reader
        .table("tenantPeople")
        .get(fixture.invited)
        .pipe(Effect.orDie);
      if (person.account.state !== "claimed") {
        return false;
      }
      const user = yield* reader
        .table("users")
        .get(person.account.userId)
        .pipe(Effect.orDie);
      const auth = yield* createAuth(yield* MutationCtx);
      const context = yield* Effect.promise(() => auth.$context);
      const accounts = yield* Effect.promise(() =>
        context.internalAdapter.findAccountByUserId(user.authId)
      );
      const hash = Option.getOrUndefined(
        Arr.findFirst(
          accounts,
          (account) => account.providerId === "credential"
        )
      )?.password;
      if (!hash) {
        return false;
      }
      return yield* Effect.promise(() =>
        context.password.verify({ hash, password })
      );
    })
  );
