import type { OptimisticLocalStore, OptimisticUpdate } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import type access from "@repo/backend/confect/_generated/refs/access";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { BuiltinRole, OwnerRole } from "@repo/backend/confect/access/schema";
import { INVITE_TERM } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, DateTime, Duration, Option, Schema } from "effect";
import {
  changeGrantPages,
  changeInviteLists,
} from "@/components/tenant/settings/mutation";
import {
  draftText,
  type Grant,
  type Invite,
  isFirstPage,
  type Person,
  withoutItem,
} from "@/components/tenant/settings/state";

/**
 * The roles the viewer may give a person. The Integration role belongs to an integration client
 * alone, and only an Owner gives the two roles that lead the school.
 */
export const givenRoles = (viewer: Option.Option<BuiltinRole>) =>
  Arr.filter(
    BuiltinRole.literals,
    (role) =>
      role !== "integration" &&
      (Option.contains(viewer, "owner") || !Schema.is(OwnerRole)(role))
  );

/** The loaded Person with this ID, read from any loaded list of people, or none when no list holds it. */
function nameOfPerson(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  personId: Person["id"]
) {
  return Arr.findFirst(
    Arr.flatMap(localStore.getAllQueries(tenancy.people.list), (query) =>
      Option.match(query.value, {
        onNone: (): Person[] => [],
        onSome: (result) => [...result.page],
      })
    ),
    (person) => person.id === personId
  );
}

/** Lists a new grant at once, at the top of the school's grants, when its Person is loaded. */
export const assignGrantChange: OptimisticUpdate<
  typeof access.grants.assign
> = (localStore, { personId, role, scope, slug }) => {
  const person = nameOfPerson(localStore, personId);
  if (Option.isNone(person)) {
    return;
  }
  const draft: Grant = {
    id: Schema.decodeUnknownSync(Id("tenantGrants"))(draftText()),
    person: { id: person.value.id, name: person.value.name },
    revocable: true,
    role: { key: role, kind: "builtin" },
    scope,
  };
  changeGrantPages(localStore, slug, isFirstPage, (page) =>
    Arr.prepend(page, draft)
  );
};

/** Takes a grant off every loaded list of the school's grants at once. */
export const revokeGrantChange: OptimisticUpdate<
  typeof access.grants.revoke
> = (localStore, { grantId, slug }) => {
  changeGrantPages(
    localStore,
    slug,
    () => true,
    (page) => withoutItem(page, grantId)
  );
};

/** Lists a new invite at once, at the top of the pending invites, when its Person is loaded. */
export const inviteChange: OptimisticUpdate<typeof tenancy.invites.invite> = (
  localStore,
  { email, personId, slug }
) => {
  const person = nameOfPerson(localStore, personId);
  if (Option.isNone(person)) {
    return;
  }
  const draft: Invite = {
    email,
    expiresAt:
      DateTime.toEpochMillis(DateTime.nowUnsafe()) +
      Duration.toMillis(INVITE_TERM),
    id: Schema.decodeUnknownSync(Id("tenantInvites"))(draftText()),
    name: person.value.name,
    personId,
    roles: [],
    status: "pending",
  };
  changeInviteLists(localStore, slug, isFirstPage, (page) =>
    Arr.prepend(page, draft)
  );
};
