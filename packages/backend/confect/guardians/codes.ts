import type { GenericId } from "@confect/core";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { components } from "@repo/backend/confect/_generated/components";
import type {
  GuardianCodesDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { createAuth } from "@repo/backend/confect/auth/runtime";
import { EMAIL_FROM, sendMail } from "@repo/backend/confect/emails/client";
import { liveLinksOfAddress } from "@repo/backend/confect/guardians/link";
import {
  CODE_TERM,
  CODE_TRIES,
  type CodeRedeem,
  type RedeemAnswer,
} from "@repo/backend/confect/guardians/schema";
import {
  drawGuardianCode,
  hashGuardianCode,
} from "@repo/backend/confect/identity/secret";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { bindPerson } from "@repo/backend/confect/tenancy/claim";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { allocateUsername } from "@repo/backend/confect/users/allocation";
import { guardianCodeEmail } from "@repo/email/templates/guardian/content";
import { Array as Arr, Clock, Duration, Effect, Option, Schema } from "effect";

/**
 * The code requests of one device and of one address: five at once, then five
 * more every fifteen minutes. The address limit keeps one visitor from flooding
 * a parent's inbox, and the device limit slows one browser (ADR 0009). These are
 * design choices, not measurements.
 */
const REQUESTS = { capacity: 5, period: 15 * MINUTE, rate: 5 };
/**
 * The sign-in attempts of one address at one school: ten at once, then ten more
 * every fifteen minutes, the limit of the username sign-in (ADR 0009). The three
 * tries of each code are the guard of the code itself.
 */
const ATTEMPTS = { capacity: 10, period: 15 * MINUTE, rate: 10 };

const LIMITS = {
  guardianCodeByAddress: { ...REQUESTS, kind: "token bucket" },
  guardianCodeByDevice: { ...REQUESTS, kind: "token bucket" },
  guardianSignInByAddress: { ...ATTEMPTS, kind: "token bucket" },
} as const;

const limits = new RateLimiter(components.agentRateLimiter, LIMITS);

/** Takes one unit of a limit, and says whether the request may go on. */
const admit = Effect.fn("guardians.codes.admit")(function* (
  name: keyof typeof LIMITS,
  key: string
) {
  const ctx = yield* MutationCtx;
  const quota = yield* Effect.tryPromise(() =>
    limits.limit(ctx, name, { key })
  ).pipe(Effect.orDie);
  return quota.ok;
});

/** The school a host names, when it is active. A suspended school signs no guardian in. */
const activeTenantOf = Effect.fn("guardians.codes.tenant")(function* (
  slug: TenantSlug
) {
  const tenant = yield* (yield* DatabaseReader)
    .table("tenants")
    .index("by_slug", (query) => query.eq("slug", slug))
    .first()
    .pipe(Effect.orDie);
  return Option.filter(tenant, (row) => row.status === "active");
});

/** The live code row of one address at one school, if any. */
const codeOf = Effect.fn("guardians.codes.of")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  email: typeof Email.Type
) {
  return yield* (yield* DatabaseReader)
    .table("guardianCodes")
    .index("by_tenantId_and_email", (query) =>
      query.eq("tenantId", tenantId).eq("email", email)
    )
    .first()
    .pipe(Effect.orDie);
});

/**
 * Draws a new code for one address at one school and stores its keyed hash, which
 * replaces the code that stood, so the old one matches nothing. It answers the
 * plain code once, for the email or the acceptance seed, and the row's ID.
 */
export const storeCode = Effect.fn("guardians.codes.store")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  email: typeof Email.Type
) {
  const now = yield* Clock.currentTimeMillis;
  const code = yield* drawGuardianCode();
  const row = {
    codeHash: yield* hashGuardianCode(tenantId, email, code),
    email,
    expiresAt: now + Duration.toMillis(CODE_TERM),
    tenantId,
    tries: 0,
  };
  const writer = yield* DatabaseWriter;
  const existing = yield* codeOf(tenantId, email);
  const codeId = yield* Option.match(existing, {
    onNone: () => writer.table("guardianCodes").insert(row),
    onSome: (stored) =>
      writer
        .table("guardianCodes")
        .replace(stored._id, row)
        .pipe(Effect.as(stored._id)),
  }).pipe(Effect.orDie);
  return { code, codeId };
});

/**
 * Sends one sign-in code to an address that holds a live link at the school, and
 * answers the same whether or not it does, so the answer never tells a visitor
 * which addresses a school links (ADR 0034). A new code replaces the old one,
 * which then matches nothing. Only the keyed hash is stored, and the code leaves
 * in the email alone, which this mutation hands to the mail queue itself.
 */
export const sendCode = Effect.fn("guardians.codes.send")(function* (input: {
  readonly deviceId: string;
  readonly email: typeof Email.Type;
  readonly locale: ActiveAppLocaleCode;
  readonly slug: TenantSlug;
}) {
  const now = yield* Clock.currentTimeMillis;
  const expiresAt = now + Duration.toMillis(CODE_TERM);
  const answer = { expiresAt };
  if (
    !(
      (yield* admit("guardianCodeByDevice", input.deviceId)) &&
      (yield* admit("guardianCodeByAddress", input.email))
    )
  ) {
    return answer;
  }
  const tenant = yield* activeTenantOf(input.slug);
  if (Option.isNone(tenant)) {
    return answer;
  }
  const links = yield* liveLinksOfAddress(tenant.value._id, input.email);
  if (links.length === 0) {
    return answer;
  }
  const { code, codeId } = yield* storeCode(tenant.value._id, input.email);
  yield* sendMail(yield* MutationCtx, {
    ...guardianCodeEmail({ code, locale: input.locale }),
    from: EMAIL_FROM,
    idempotencyKey: `guardian-code/${codeId}/${now}`,
    to: input.email,
  }).pipe(Effect.orDie);
  return answer;
});

/** Deletes one code row: it was used, its tries ran out, or it expired. */
const dropCode = (code: GuardianCodesDoc) =>
  Effect.flatMap(DatabaseWriter, (writer) =>
    writer.table("guardianCodes").delete(code._id).pipe(Effect.orDie)
  );

/**
 * Checks one typed code. A wrong code takes one try, and the third wrong try voids
 * the code. An expired code is deleted. Every refusal reads the same.
 */
const checkCode = Effect.fn("guardians.codes.check")(function* (
  code: GuardianCodesDoc,
  typed: string
) {
  if (code.expiresAt <= (yield* Clock.currentTimeMillis)) {
    yield* dropCode(code);
    return false;
  }
  if (
    (yield* hashGuardianCode(code.tenantId, code.email, typed)) ===
    code.codeHash
  ) {
    yield* dropCode(code);
    return true;
  }
  if (code.tries + 1 >= CODE_TRIES) {
    yield* dropCode(code);
    return false;
  }
  yield* (yield* DatabaseWriter)
    .table("guardianCodes")
    .patch(code._id, { tries: code.tries + 1 })
    .pipe(Effect.orDie);
  return false;
});

/**
 * The Better Auth account of a guardian Person. A claimed Person keeps its account.
 * An unclaimed Person is bound to the account that holds the address, or to a new
 * account made for it, since the code proved the address. The claim is journaled as
 * `person.claimed` with the method `code` (ADR 0034).
 */
const accountOf = Effect.fn("guardians.codes.account")(function* (
  guardian: TenantPeopleDoc,
  email: typeof Email.Type
) {
  const reader = yield* DatabaseReader;
  if (guardian.account.state === "claimed") {
    const user = yield* reader
      .table("users")
      .get(guardian.account.userId)
      .pipe(Effect.orDie);
    return user.authId;
  }
  // A missing site or Google setting is a deployment defect, not a refusal.
  const auth = yield* createAuth(yield* MutationCtx).pipe(Effect.orDie);
  const context = yield* Effect.promise(() => auth.$context);
  const found = yield* Effect.promise(() =>
    context.internalAdapter.findUserByEmail(email)
  );
  const authId = yield* Option.match(Option.fromNullishOr(found), {
    onNone: () =>
      Effect.gen(function* () {
        const username = yield* allocateUsername(guardian.name);
        const created = yield* Effect.promise(() =>
          context.internalAdapter.createUser({
            email,
            emailVerified: true,
            name: guardian.name,
            username,
          })
        );
        return created.id;
      }),
    onSome: ({ user }) => Effect.succeed(user.id),
  });
  const user = yield* reader
    .table("users")
    .get("by_authId", authId)
    .pipe(Effect.orDie);
  yield* bindPerson(guardian, {
    claimedAt: yield* Clock.currentTimeMillis,
    method: "code",
    state: "claimed",
    userId: user._id,
  });
  yield* personAuthority.record(personActor(guardian), guardian, {
    method: "code",
    type: "person.claimed",
  });
  return authId;
});

/**
 * Redeems one guardian code for the sign-in endpoint of the school host. The code
 * must be the live code of the address at that school, and the address must still
 * hold a live link there. It answers the Better Auth account to sign in, and the
 * endpoint makes the session. Signing in is not consent for a child (K2): the
 * consent waits for the NISN check or for staff.
 */
export const redeemCode = Effect.fn("guardians.codes.redeem")(function* (
  input: typeof CodeRedeem.Type
) {
  const refused: typeof RedeemAnswer.Type = { outcome: "refused" };
  const email = Schema.decodeOption(Email)(input.email);
  const slug = Schema.decodeOption(TenantSlug)(input.slug);
  if (Option.isNone(email) || Option.isNone(slug)) {
    return refused;
  }
  const tenant = yield* activeTenantOf(slug.value);
  if (Option.isNone(tenant)) {
    return refused;
  }
  if (
    !(yield* admit(
      "guardianSignInByAddress",
      `${tenant.value._id}:${email.value}`
    ))
  ) {
    return refused;
  }
  const code = yield* codeOf(tenant.value._id, email.value);
  if (Option.isNone(code) || !(yield* checkCode(code.value, input.code))) {
    return refused;
  }
  const link = Arr.head(
    yield* liveLinksOfAddress(tenant.value._id, email.value)
  );
  if (Option.isNone(link)) {
    return refused;
  }
  const guardian = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .get(link.value.guardianPersonId)
    .pipe(Effect.orDie);
  if (guardian.status !== "active") {
    return refused;
  }
  const answer: typeof RedeemAnswer.Type = {
    authId: yield* accountOf(guardian, email.value),
    outcome: "signedIn",
  };
  return answer;
});

/** Codes one sweep deletes; a backlog takes more runs. */
const SWEEP_LIMIT = 100;

/** Deletes codes that expired unused (ADR 0034). */
export const sweepCodes = Effect.fn("guardians.codes.sweep")(function* () {
  const now = yield* Clock.currentTimeMillis;
  const expired = yield* (yield* DatabaseReader)
    .table("guardianCodes")
    .index("by_expiresAt", (query) => query.lte("expiresAt", now))
    .take(SWEEP_LIMIT)
    .pipe(Effect.orDie);
  yield* Effect.forEach(expired, dropCode, { discard: true });
  return null;
});
