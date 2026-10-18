"use client";

import type { OptimisticLocalStore, OptimisticUpdate } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import identity from "@repo/backend/confect/_generated/refs/identity";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { INVITE_TERM } from "@repo/backend/confect/tenancy/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, DateTime, Duration, Option, Schema } from "effect";
import { changeInviteLists } from "@/components/tenant/settings/mutation.client";
import {
  draftText,
  type Invite,
  isFirstPage,
  type Login,
  type Member,
} from "@/components/tenant/settings/state";

/**
 * The optimistic changes of the members and the student accounts. Each one shows a
 * mutation's result on the first page of every loaded list it touches, so the row
 * appears at once. A refused change is undone by Confect when the server answers.
 */

/** Changes the first page of every loaded members list of one school. */
function changeMemberLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: TenantSlug,
  change: (page: readonly Member[]) => Member[]
) {
  for (const query of localStore.getAllQueries(tenancy.roster.members)) {
    if (
      Option.isSome(query.value) &&
      query.args.slug === slug &&
      isFirstPage(query.args)
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
  };
  const member: Member = {
    id: personId,
    name,
    roles: [role],
    status: "invited",
  };
  changeInviteLists(localStore, slug, isFirstPage, (page) =>
    Arr.prepend(page, invite)
  );
  changeMemberLists(localStore, slug, (page) => Arr.prepend(page, member));
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
