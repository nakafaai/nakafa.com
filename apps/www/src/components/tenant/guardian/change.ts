import type { Ref } from "@confect/core";
import type { OptimisticLocalStore, OptimisticUpdate } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { LINK_TERM } from "@repo/backend/confect/guardians/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, DateTime, Duration, Option, Schema } from "effect";
import { draftText } from "@/components/tenant/settings/state";

/** One guardian link as the Staff list shows it. */
export type LinkItem = Ref.Returns<typeof guardians.links.list>["page"][number];

/** One child as the parent home shows it. */
export type ChildItem = Ref.Returns<typeof guardians.family.children>[number];

/** Sets the status of one link on a page, and keeps every other link as it is. */
export function setLinkStatus(
  page: readonly LinkItem[],
  linkId: LinkItem["id"],
  status: LinkItem["status"]
) {
  return Arr.map(page, (link) =>
    link.id === linkId ? { ...link, status } : link
  );
}

/** Sets the status of one child's link, and keeps every other child as it is. */
export function setChildStatus(
  children: readonly ChildItem[],
  linkId: ChildItem["linkId"],
  status: ChildItem["status"]
) {
  return Arr.map(children, (child) =>
    child.linkId === linkId ? { ...child, status } : child
  );
}

/** Changes the page of every loaded list of one school's links that the matches accept. */
function changeLinkPages(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: TenantSlug,
  matches: (args: Ref.Args<typeof guardians.links.list>) => boolean,
  change: (page: readonly LinkItem[]) => LinkItem[]
) {
  for (const query of localStore.getAllQueries(guardians.links.list)) {
    if (
      Option.isSome(query.value) &&
      query.args.slug === slug &&
      matches(query.args)
    ) {
      localStore.setQuery(
        guardians.links.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
      );
    }
  }
}

/** The name of a student that a loaded list of the school's students holds. */
function studentNameOf(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: TenantSlug,
  personId: LinkItem["student"]["id"]
) {
  return Arr.findFirst(
    localStore.getAllQueries(tenancy.people.students),
    (query) =>
      query.args.slug === slug && Option.isSome(query.value)
        ? Arr.findFirst(
            query.value.value.page,
            (student) => student.id === personId
          ).pipe(Option.map((student) => student.name))
        : Option.none()
  );
}

/**
 * Lists a new link at once, pending, at the top of the first page of the school's links,
 * when the picker has loaded its student. The server answers the real row.
 */
export const startLinkChange: OptimisticUpdate<typeof guardians.links.start> = (
  localStore,
  { email, guardianName, slug, studentId }
) => {
  const name = studentNameOf(localStore, slug, studentId);
  if (Option.isNone(name)) {
    return;
  }
  const now = DateTime.toEpochMillis(DateTime.nowUnsafe());
  const draft: LinkItem = {
    email,
    expiresAt: now + Duration.toMillis(LINK_TERM),
    guardian: {
      id: Schema.decodeUnknownSync(Id("tenantPeople"))(draftText()),
      name: guardianName,
    },
    id: Schema.decodeUnknownSync(Id("guardianLinks"))(draftText()),
    mismatches: 0,
    status: "pending",
    student: { id: studentId, name: name.value },
  };
  changeLinkPages(
    localStore,
    slug,
    (args) => args.paginationOpts.cursor === null,
    (page) => Arr.prepend(page, draft)
  );
};

/** Shows a link as verified at once, when Staff checks it by hand. */
export const verifyLinkChange: OptimisticUpdate<
  typeof guardians.links.verify
> = (localStore, { linkId, slug }) =>
  changeLinkPages(
    localStore,
    slug,
    () => true,
    (page) => setLinkStatus(page, linkId, "verified")
  );

/** Shows a link as revoked at once. */
export const revokeLinkChange: OptimisticUpdate<
  typeof guardians.links.revoke
> = (localStore, { linkId, slug }) =>
  changeLinkPages(
    localStore,
    slug,
    () => true,
    (page) => setLinkStatus(page, linkId, "revoked")
  );

/** Shows a child's link as withdrawn at once, when the guardian withdraws consent. */
export const withdrawChange: OptimisticUpdate<
  typeof guardians.family.withdraw
> = (localStore, { linkId, slug }) => {
  const current = localStore.getQuery(guardians.family.children, { slug });
  if (Option.isNone(current)) {
    return;
  }
  localStore.setQuery(
    guardians.family.children,
    { slug },
    Option.some(setChildStatus(current.value, linkId, "withdrawn"))
  );
};
