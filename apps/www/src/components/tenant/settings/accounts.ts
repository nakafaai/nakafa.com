import type { Ref } from "@confect/core";
import type { OptimisticLocalStore, OptimisticUpdate } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import identity from "@repo/backend/confect/_generated/refs/identity";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { INVITE_TERM } from "@repo/backend/confect/tenancy/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, DateTime, Duration, Option, Schema } from "effect";
import { changeInviteLists } from "@/components/tenant/settings/mutation";
import {
  draftText,
  type Invite,
  isFirstPage,
  type Login,
  type Member,
  withoutItem,
} from "@/components/tenant/settings/state";

/**
 * The optimistic changes of the members and the student accounts. Each one shows a
 * mutation's result on every loaded page it touches, or on the first page where a new
 * row belongs, so the change appears at once. A refused change is undone by Confect
 * when the server answers.
 */

/** Changes the page of every loaded members list of one school that the matches accept. */
function changeMemberLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: TenantSlug,
  matches: (args: Ref.Args<typeof tenancy.roster.members>) => boolean,
  change: (page: readonly Member[]) => Member[]
) {
  for (const query of localStore.getAllQueries(tenancy.roster.members)) {
    if (
      Option.isSome(query.value) &&
      query.args.slug === slug &&
      matches(query.args)
    ) {
      localStore.setQuery(
        tenancy.roster.members,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
      );
    }
  }
}

/**
 * Shows a teacher or an Admin as invited at once: a member row with the role and an
 * invite row, both at the top of the first page of their lists.
 */
export const addMemberChange: OptimisticUpdate<typeof tenancy.roster.invite> = (
  localStore,
  { email, name, role, slug }
) => {
  const personId = Schema.decodeUnknownSync(Id("tenantPeople"))(draftText());
  const invite: Invite = {
    email,
    expiresAt:
      DateTime.toEpochMillis(DateTime.nowUnsafe()) +
      Duration.toMillis(INVITE_TERM),
    id: Schema.decodeUnknownSync(Id("tenantInvites"))(draftText()),
    name,
    personId,
    roles: [role],
    status: "pending",
  };
  // Whoever may give the role may also end it, so the list answers the new row as removable.
  const member: Member = {
    id: personId,
    name,
    removable: true,
    roles: [role],
    status: "invited",
  };
  changeInviteLists(localStore, slug, isFirstPage, (page) =>
    Arr.prepend(page, invite)
  );
  changeMemberLists(localStore, slug, isFirstPage, (page) =>
    Arr.prepend(page, member)
  );
};

/** Takes a member off every loaded members list of the school at once. */
export const removeMemberChange: OptimisticUpdate<
  typeof tenancy.people.remove
> = (localStore, { personId, slug }) => {
  changeMemberLists(
    localStore,
    slug,
    () => true,
    (page) => withoutItem(page, personId)
  );
};

/**
 * Shows a student and its login at once, at the top of the first page of the school's
 * logins. The login name is shown as the school stores it: lowercase, without spaces.
 */
export const addStudentChange: OptimisticUpdate<
  typeof identity.cards.enroll
> = (localStore, { loginName, name, slug }) => {
  const login: Login = {
    issuedAt: DateTime.toEpochMillis(DateTime.nowUnsafe()),
    loginName,
    person: {
      id: Schema.decodeUnknownSync(Id("tenantPeople"))(draftText()),
      name,
    },
  };
  for (const query of localStore.getAllQueries(identity.logins.list)) {
    if (
      Option.isSome(query.value) &&
      query.args.slug === slug &&
      isFirstPage(query.args)
    ) {
      localStore.setQuery(
        identity.logins.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.prepend(query.value.value.page, login),
        })
      );
    }
  }
};

/** Changes the login of one person on every loaded page of the school's logins, and keeps the others as they are. */
function changeLogins(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: TenantSlug,
  personId: Login["person"]["id"],
  change: (login: Login) => Login
) {
  for (const query of localStore.getAllQueries(identity.logins.list)) {
    if (Option.isSome(query.value) && query.args.slug === slug) {
      localStore.setQuery(
        identity.logins.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.map(query.value.value.page, (login) =>
            login.person.id === personId ? change(login) : login
          ),
        })
      );
    }
  }
}

/**
 * Shows a login's card as issued now in every loaded list of the school's logins, while the server
 * reissues it. The list keeps its order, and a refused reissue is undone when the server answers.
 */
export const reissueCardChange: OptimisticUpdate<
  typeof identity.cards.reissue
> = (localStore, { personId, slug }) => {
  changeLogins(localStore, slug, personId, (login) => ({
    ...login,
    issuedAt: DateTime.toEpochMillis(DateTime.nowUnsafe()),
  }));
};

/** Shows a login under its new login name at once, on every loaded page of the school's logins. */
export const renameLoginChange: OptimisticUpdate<
  typeof identity.logins.rename
> = (localStore, { loginName, personId, slug }) => {
  changeLogins(localStore, slug, personId, (login) => ({
    ...login,
    loginName,
  }));
};

/** Shows a person under their new name at once, on every loaded page of the school's members and of its logins. */
export const renamePersonChange: OptimisticUpdate<
  typeof tenancy.people.rename
> = (localStore, { name, personId, slug }) => {
  changeMemberLists(
    localStore,
    slug,
    () => true,
    (page) =>
      Arr.map(page, (member) =>
        member.id === personId ? { ...member, name } : member
      )
  );
  changeLogins(localStore, slug, personId, (login) => ({
    ...login,
    person: { ...login.person, name },
  }));
  for (const query of localStore.getAllQueries(guardians.links.list)) {
    if (Option.isSome(query.value) && query.args.slug === slug) {
      localStore.setQuery(
        guardians.links.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.map(query.value.value.page, (link) =>
            link.guardian.id === personId
              ? { ...link, guardian: { ...link.guardian, name } }
              : link
          ),
        })
      );
    }
  }
};
