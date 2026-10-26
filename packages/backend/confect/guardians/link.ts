import type { GenericId } from "@confect/core";
import type {
  GuardianLinksDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  guardianLinkAuthority,
  readLinkedPerson,
} from "@repo/backend/confect/guardians/authority";
import {
  CONSENT_POLICY_VERSION,
  type ChildView,
  type ConsentMethod,
  type LinkEndReason,
  type LinkState,
  type LinkStatus,
  type LinkView,
} from "@repo/backend/confect/guardians/schema";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { rosterEntryOf } from "@repo/backend/confect/roster/entry";
import type { Email } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Clock, Effect, Match, Option, Struct } from "effect";

/** The most links one address or one guardian holds in a school; every read of them takes this many. */
export const LINK_LIMIT = 20;

/** The state of a link as lists show it. An unverified link past its term reads as expired. */
export const linkStatusOf = (
  link: Pick<GuardianLinksDoc, "expiresAt" | "state">,
  now: number
): typeof LinkStatus.Type =>
  Match.value(link.state).pipe(
    Match.when({ status: "pending" }, () =>
      link.expiresAt <= now ? "expired" : "pending"
    ),
    Match.when({ status: "verified" }, () => "verified" as const),
    Match.when({ status: "ended" }, ({ reason }) => reason),
    Match.exhaustive
  );

/** Whether a link still stands: verified, or pending inside its term. */
export const isLive = (
  link: Pick<GuardianLinksDoc, "expiresAt" | "state">,
  now: number
) => {
  const status = linkStatusOf(link, now);
  return status === "pending" || status === "verified";
};

/** The links of one address at one school, live or not, bounded. */
export const linksOfAddress = Effect.fn("guardians.link.ofAddress")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  email: typeof Email.Type
) {
  return yield* (yield* DatabaseReader)
    .table("guardianLinks")
    .index("by_tenantId_and_email", (query) =>
      query.eq("tenantId", tenantId).eq("email", email)
    )
    .take(LINK_LIMIT)
    .pipe(Effect.orDie);
});

/** The live links of one address at one school, at this moment. */
export const liveLinksOfAddress = Effect.fn("guardians.link.liveOfAddress")(
  function* (
    tenantId: GenericId.GenericId<"tenants">,
    email: typeof Email.Type
  ) {
    const now = yield* Clock.currentTimeMillis;
    return Arr.filter(yield* linksOfAddress(tenantId, email), (link) =>
      isLive(link, now)
    );
  }
);

/** The links one guardian Person holds, bounded. */
export const linksOfGuardian = Effect.fn("guardians.link.ofGuardian")(
  function* (guardianPersonId: GenericId.GenericId<"tenantPeople">) {
    return yield* (yield* DatabaseReader)
      .table("guardianLinks")
      .index("by_guardianPersonId", (query) =>
        query.eq("guardianPersonId", guardianPersonId)
      )
      .take(LINK_LIMIT)
      .pipe(Effect.orDie);
  }
);

/** One link as staff list it, with the names of its two Persons. */
export const linkViewOf = Effect.fn("guardians.link.view")(function* (
  link: GuardianLinksDoc,
  now: number
) {
  const [guardian, student] = yield* Effect.all(
    [
      readLinkedPerson(link.guardianPersonId),
      readLinkedPerson(link.studentPersonId),
    ],
    { concurrency: "unbounded" }
  );
  const view: typeof LinkView.Type = {
    email: link.email,
    expiresAt: link.expiresAt,
    guardian: { id: guardian._id, name: guardian.name },
    id: link._id,
    mismatches: link.mismatches,
    status: linkStatusOf(link, now),
    student: { id: student._id, name: student.name },
  };
  return view;
});

/**
 * One link as its guardian sees it. `staffCheck` holds when the school keeps no
 * NISN for the child, so the guardian waits for staff to check the link.
 */
export const childViewOf = Effect.fn("guardians.link.child")(function* (
  link: GuardianLinksDoc,
  now: number
) {
  const student = yield* readLinkedPerson(link.studentPersonId);
  const entry = yield* rosterEntryOf(link.studentPersonId);
  const view: typeof ChildView.Type = {
    linkId: link._id,
    staffCheck: Option.getOrUndefined(entry)?.nisn === undefined,
    status: linkStatusOf(link, now),
    student: { id: student._id, name: student.name },
  };
  return view;
});

/** Writes the next version of one link and answers it. */
const replaceLink = Effect.fn("guardians.link.replace")(function* (
  next: GuardianLinksDoc
) {
  yield* (yield* DatabaseWriter)
    .table("guardianLinks")
    .replace(next._id, Struct.omit(next, ["_creationTime", "_id"]))
    .pipe(Effect.orDie);
  return next;
});

/** Counts one failed NISN check on a link, which staff see in the list. */
export const countMismatch = (link: GuardianLinksDoc) =>
  replaceLink(Struct.assign(link, { mismatches: link.mismatches + 1 }));

/**
 * Grants consent on a link: writes the `granted` ledger row, makes the link the
 * verified relation, and journals `guardian.linked`, all in one transaction
 * (ADR 0034). `checker` is the guardian for `code_nisn` and the staff Person for
 * `staff`.
 */
export const grantConsent = Effect.fn("guardians.link.grant")(function* (
  link: GuardianLinksDoc,
  method: typeof ConsentMethod.Type,
  checker: TenantPeopleDoc,
  actor: typeof TenantActor.Type
) {
  const at = yield* Clock.currentTimeMillis;
  yield* (yield* DatabaseWriter)
    .table("guardianConsents")
    .insert({
      action: "granted",
      at,
      checker: checker._id,
      guardianPersonId: link.guardianPersonId,
      linkId: link._id,
      method,
      policyVersion: CONSENT_POLICY_VERSION,
      studentPersonId: link.studentPersonId,
      tenantId: link.tenantId,
    })
    .pipe(Effect.orDie);
  const state: LinkState = { at, status: "verified" };
  const verified = yield* replaceLink(Struct.assign(link, { state }));
  yield* guardianLinkAuthority.record(actor, link, {
    method,
    student: link.studentPersonId,
    type: "guardian.linked",
  });
  return verified;
});

/**
 * The `granted` row of a verified link: its newest ledger row, since a verified
 * link has been granted and not withdrawn. A verified link without one is a defect.
 */
const grantOf = Effect.fn("guardians.link.grantOf")(function* (
  linkId: GenericId.GenericId<"guardianLinks">
) {
  return yield* (yield* DatabaseReader)
    .table("guardianConsents")
    .index("by_linkId", (query) => query.eq("linkId", linkId), "desc")
    .first()
    .pipe(
      Effect.orDie,
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.die("A verified link has no consent row."),
          onSome: Effect.succeed,
        })
      )
    );
});

/**
 * Ends one link at once. A guardian's withdrawal writes the `withdrawn` ledger row
 * that ends the consent, a school's revocation leaves the ledger as it stands, and
 * either ends the relation in the same transaction (ADR 0034).
 */
export const endLink = Effect.fn("guardians.link.end")(function* (
  link: GuardianLinksDoc,
  reason: Exclude<typeof LinkEndReason.Type, "expired">,
  actor: typeof TenantActor.Type,
  checker: TenantPeopleDoc
) {
  const at = yield* Clock.currentTimeMillis;
  const wasVerified = link.state.status === "verified";
  if (reason === "withdrawn" && wasVerified) {
    const grant = yield* grantOf(link._id);
    yield* (yield* DatabaseWriter)
      .table("guardianConsents")
      .insert({
        action: "withdrawn",
        at,
        checker: checker._id,
        guardianPersonId: link.guardianPersonId,
        linkId: link._id,
        method: grant.method,
        policyVersion: CONSENT_POLICY_VERSION,
        studentPersonId: link.studentPersonId,
        tenantId: link.tenantId,
      })
      .pipe(Effect.orDie);
  }
  const state: LinkState = { at, reason, status: "ended" };
  const ended = yield* replaceLink(Struct.assign(link, { state }));
  yield* guardianLinkAuthority.record(actor, link, {
    student: link.studentPersonId,
    type: reason === "withdrawn" ? "guardian.withdrawn" : "guardian.revoked",
  });
  return ended;
});
