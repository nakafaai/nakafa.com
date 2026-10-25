import type { GenericId } from "@confect/core";
import { FunctionImpl } from "@confect/server";
import type {
  TenantInvitesDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { purgeInvite } from "@repo/backend/confect/notifications/purge";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { replaceInviteState } from "@repo/backend/confect/tenancy/invite";
import spec from "@repo/backend/confect/tenancy/invites.spec";
import { Array as Arr, Clock, Effect, Struct } from "effect";

/**
 * Whether a pending invite still waits: one whose term has ended is expired, even before its
 * scheduled expiry runs. Only the pending and expired invites of a school are shown.
 */
const statusOf = (
  invite: TenantInvitesDoc,
  now: number
): "expired" | "pending" =>
  invite.state.status === "pending" && invite.expiresAt > now
    ? "pending"
    : "expired";

/**
 * One invite as the wire shows it: the Person it invites with the name and the roles that
 * Person holds, and the status of the invite.
 */
export const viewOf = Effect.fnUntraced(function* (
  invite: TenantInvitesDoc,
  person: TenantPeopleDoc
) {
  const now = yield* Clock.currentTimeMillis;
  const grants = yield* activeGrants(person._id);
  return {
    email: invite.channel.email,
    expiresAt: invite.expiresAt,
    id: invite._id,
    name: person.name,
    personId: invite.personId,
    roles: Arr.dedupe(Arr.map(grants, (grant) => grant.role.key)),
    status: statusOf(invite, now),
  };
});

/**
 * Loads one invite by ID. An invite that does not exist is denied the way an
 * invite of another school is, so an ID probe reveals nothing.
 */
export const loadInvite = Effect.fnUntraced(function* (
  inviteId: GenericId.GenericId<"tenantInvites">
) {
  return yield* (yield* DatabaseReader)
    .table("tenantInvites")
    .get(inviteId)
    .pipe(
      Effect.catchTags({
        DocumentDecodeError: Effect.die,
        GetByIdFailure: () =>
          new AccessDenied({ action: "person.invite", reason: "resource" }),
      })
    );
});

/**
 * The pending and expired invites of one school, a page at a time, the pending ones first
 * and each group newest first, with the name and the roles of each Person.
 */
export const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("tenancy.invites.list")(function* ({ paginationOpts }) {
    const { tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const page = yield* reader
      .table("tenantInvites")
      .index(
        "by_tenantId_and_state_status",
        (query) =>
          query
            .eq("tenantId", tenant._id)
            .gte("state.status", "expired")
            .lte("state.status", "pending"),
        "desc"
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const rows = yield* Effect.forEach(
      page.page,
      (invite) =>
        reader
          .table("tenantPeople")
          .get(invite.personId)
          .pipe(
            Effect.orDie,
            Effect.flatMap((person) => viewOf(invite, person))
          ),
      { concurrency: "unbounded" }
    );
    return Struct.assign(page, { page: rows });
  })
);

/** Revokes a pending invite. An invite that is no longer pending changes nothing. */
export const revoke = FunctionImpl.make(
  databaseSchema,
  spec,
  "revoke",
  Effect.fn("tenancy.invites.revoke")(function* ({ inviteId }) {
    const { person: actor } = yield* Member;
    const stored = yield* loadInvite(inviteId);
    const person = yield* personAuthority.authorize(
      "person.invite",
      stored.personId
    );
    if (stored.state.status === "pending") {
      yield* replaceInviteState(stored, {
        at: yield* Clock.currentTimeMillis,
        status: "revoked",
      });
      yield* purgeInvite(stored.personId, stored._id);
      yield* personAuthority.record(personActor(actor), person, {
        invite: stored._id,
        type: "invite.revoked",
      });
    }
    return null;
  })
);
