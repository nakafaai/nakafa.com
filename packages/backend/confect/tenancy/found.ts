import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import type { UsersDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { assignRole } from "@repo/backend/confect/access/grant";
import { readSiteUrl } from "@repo/backend/confect/site/config";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  readAddress,
  schoolAddress,
} from "@repo/backend/confect/tenancy/address";
import {
  periodAuthority,
  personAuthority,
  tenantAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { FoundingRefused } from "@repo/backend/confect/tenancy/errors";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import {
  countryDefaults,
  type StartRequest,
  startZone,
} from "@repo/backend/confect/tenancy/start";
import { createUnit } from "@repo/backend/confect/tenancy/write/unit";
import { schoolYear } from "@repo/backend/confect/tenancy/year";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import {
  Array as Arr,
  Clock,
  DateTime,
  Effect,
  Option,
  Schema,
  String as Str,
  Stream,
} from "effect";

/** The schools one account may found and still run as their Owner. */
const FOUNDED_SCHOOL_LIMIT = 3;

/**
 * A bucket of three openings that refills three a day, so an account that
 * removes itself from its schools still cannot open them in a loop.
 */
const openings = new RateLimiter(components.agentRateLimiter, {
  schoolOpen: {
    capacity: 3,
    kind: "token bucket",
    period: 24 * HOUR,
    rate: 3,
  },
});

/**
 * The name the founder's Person takes: the first line of the account's name,
 * trimmed and cut to the 120 characters a Person name holds. An account whose
 * name holds nothing is named by the part of its email before the `@`.
 */
const founderName = (user: UsersDoc) => {
  const line = Arr.headNonEmpty(Str.split(user.name, "\n"));
  const trimmed = line.trim().slice(0, 120).trim();
  return Schema.decodeSync(PersonName)(
    trimmed === "" ? Arr.headNonEmpty(Str.split(user.email, "@")) : trimmed
  );
};

/**
 * Whether the account still holds, as an active member, as many schools it
 * founded as one account may. The read stops at the limit.
 */
const atSchoolLimit = Effect.fn("tenancy.found.limit")(function* (
  user: UsersDoc
) {
  const founded = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .index("by_account_userId_and_kind_and_status", (query) =>
      query
        .eq("account.userId", user._id)
        .eq("kind", "member")
        .eq("status", "active")
    )
    .stream()
    .pipe(
      Stream.filter(
        (person) =>
          person.account.state === "claimed" &&
          person.account.method === "founder"
      ),
      Stream.take(FOUNDED_SCHOOL_LIMIT),
      Stream.runCount,
      Effect.orDie
    );
  return founded >= FOUNDED_SCHOOL_LIMIT;
});

/** Refuses an opening that the address, the account's limit, or its rate does not allow. */
const checkOpening = Effect.fn("tenancy.found.check")(function* (
  user: UsersDoc,
  slug: string
) {
  const address = yield* readAddress(slug);
  if (address === "reserved" || address === "invalid") {
    return yield* new FoundingRefused({
      code: "SLUG_RESERVED",
      message: "This address is reserved.",
    });
  }
  if (address === "taken") {
    return yield* new FoundingRefused({
      code: "SLUG_TAKEN",
      message: "Another school already uses this address.",
    });
  }
  if (yield* atSchoolLimit(user)) {
    return yield* new FoundingRefused({
      code: "SCHOOL_LIMIT",
      message: `One account founds at most ${FOUNDED_SCHOOL_LIMIT} schools.`,
    });
  }
  const ctx = yield* MutationCtx;
  const quota = yield* Effect.tryPromise(() =>
    openings.limit(ctx, "schoolOpen", { key: user._id })
  ).pipe(Effect.orDie);
  if (!quota.ok) {
    return yield* new FoundingRefused({
      code: "RATE_LIMITED",
      message: "This account opened schools too quickly.",
    });
  }
});

/**
 * Opens a school that an account founds by itself, in one transaction (K42):
 * the tenant and its key, the founder's Person claimed by the account at once,
 * the Owner role and the role the founder chose, one unit for each level, and
 * each unit's active period for the school year now running in its country.
 * Every write is journaled under the founder's Person, as the operator's
 * opening journals under the system. The account's draft is removed, and the
 * answer names the school's own address, where the founder goes next.
 */
export const foundSchool = Effect.fn("tenancy.found")(function* (
  user: UsersDoc,
  args: typeof StartRequest.Type
) {
  yield* checkOpening(user, args.slug);
  // The address is read before any write: a site without a host is a
  // deployment defect, and no school opens that its founder cannot reach.
  const address = yield* schoolAddress(yield* readSiteUrl(), args.slug).pipe(
    Effect.orDie
  );
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const defaults = countryDefaults[args.country];
  const now = yield* Clock.currentTimeMillis;
  const tenantId = yield* writer
    .table("tenants")
    .insert({
      country: args.country,
      currency: defaults.currency,
      kind: args.role === "foundation" ? "foundation" : "school",
      name: args.name,
      policies: NEW_TENANT_POLICIES,
      slug: args.slug,
      status: "active",
    })
    .pipe(Effect.orDie);
  yield* createTenantKey(tenantId).pipe(Effect.orDie);
  const ownerId = yield* writer
    .table("tenantPeople")
    .insert({
      account: {
        claimedAt: now,
        method: "founder",
        state: "claimed",
        userId: user._id,
      },
      kind: "member",
      name: founderName(user),
      status: "active",
      tenantId,
    })
    .pipe(Effect.orDie);
  const owner = yield* reader
    .table("tenantPeople")
    .get(ownerId)
    .pipe(Effect.orDie);
  const actor = personActor(owner);
  yield* tenantAuthority.record(
    actor,
    yield* reader.table("tenants").get(tenantId).pipe(Effect.orDie),
    { size: args.size, type: "tenant.founded" }
  );
  yield* personAuthority.record(actor, owner, { type: "person.created" });
  yield* personAuthority.record(actor, owner, {
    method: "founder",
    type: "person.claimed",
  });
  // A new active member Person in a new tenant meets every grant invariant.
  yield* assignRole(actor, owner, "owner", { kind: "tenant" }).pipe(
    Effect.orDie
  );
  if (args.role !== "foundation") {
    yield* assignRole(actor, owner, args.role, { kind: "tenant" }).pipe(
      Effect.orDie
    );
  }
  const timeZone = startZone(args.country, args.timeZone);
  const year = schoolYear(
    DateTime.makeZonedUnsafe(now, { timeZone }),
    defaults.yearStart
  );
  yield* Effect.forEach(args.units, (draft) =>
    Effect.gen(function* () {
      const unit = yield* createUnit(actor, tenantId, {
        contentLanguage: defaults.contentLanguage,
        level: draft.level,
        name: draft.name,
        timeZone,
      });
      const periodId = yield* writer
        .table("tenantPeriods")
        .insert({ ...year, status: "active", tenantId, unitId: unit._id })
        .pipe(Effect.orDie);
      const period = yield* reader
        .table("tenantPeriods")
        .get(periodId)
        .pipe(Effect.orDie);
      yield* periodAuthority.record(actor, period, { type: "period.created" });
      yield* periodAuthority.record(actor, period, { type: "period.opened" });
    })
  );
  const draft = yield* reader
    .table("tenantDrafts")
    .index("by_userId", (query) => query.eq("userId", user._id))
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(draft)) {
    yield* writer
      .table("tenantDrafts")
      .delete(draft.value._id)
      .pipe(Effect.orDie);
  }
  return { address, slug: args.slug };
});
