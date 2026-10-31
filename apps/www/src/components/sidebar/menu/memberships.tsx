import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr, Effect } from "effect";
import { useEffect } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useAuthSession } from "@/components/auth/session";
import {
  SidebarKnownSchoolItems,
  SidebarSchoolMenuItem,
  SidebarSchools,
} from "@/components/sidebar/menu/schools";
import { saveKnownSchools } from "@/lib/identity/schools";

/** How many schools the account menu loads at a time: the first page, then each page as the list reaches its end. */
const SCHOOL_PAGE = 20;

/**
 * The account's schools, read live. The menu loads this part, and with it the
 * school contracts, once it warms, so no page carries them in its first
 * JavaScript. The schools are the account's own, so they are read once Convex
 * holds its session, and the rows the browser kept stand until the first page
 * answers. A failed read shows one disabled line, so the group is never silently
 * empty. The next page loads as the end of the list comes into view.
 */
export function SidebarMembershipItems() {
  const t = useTranslations("Common");
  const isAuthenticated = useConvexAuth(
    (auth) => auth.isAuthenticated && !auth.isLoading
  );
  const sessionId = useAuthSession((session) => session.sessionId);
  const memberships = usePaginatedQuery(
    tenancy.memberships.list,
    isAuthenticated ? {} : "skip",
    { initialNumItems: SCHOOL_PAGE }
  );
  const isAnswered = !(
    PaginatedQueryResult.isLoadingFirstPage(memberships) ||
    PaginatedQueryResult.isFailure(memberships)
  );

  useEffect(() => {
    if (isAnswered && sessionId !== null) {
      Effect.runSync(
        saveKnownSchools(
          sessionId,
          Arr.map(memberships.results, ({ tenant }) => tenant)
        )
      );
    }
  }, [isAnswered, memberships.results, sessionId]);

  if (PaginatedQueryResult.isFailure(memberships)) {
    return <DropdownMenuItem disabled>{t("load-error")}</DropdownMenuItem>;
  }
  if (PaginatedQueryResult.isLoadingFirstPage(memberships)) {
    return <SidebarKnownSchoolItems />;
  }
  return (
    <>
      {Arr.map(memberships.results, ({ tenant }) => (
        <SidebarSchoolMenuItem key={tenant.slug} tenant={tenant} />
      ))}
      {PaginatedQueryResult.isCanLoadMore(memberships) ? (
        <Intersection onIntersect={() => memberships.loadMore(SCHOOL_PAGE)} />
      ) : null}
    </>
  );
}

/** The whole group of schools, for a menu that loads it in one piece, as a school's switcher does. */
export function SidebarMembershipGroup({
  canOpenSchool,
}: {
  canOpenSchool: boolean;
}) {
  return (
    <SidebarSchools canOpenSchool={canOpenSchool}>
      <SidebarMembershipItems />
    </SidebarSchools>
  );
}
