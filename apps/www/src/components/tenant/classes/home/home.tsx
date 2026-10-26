import { PaginatedQueryResult } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ItemGroup } from "@repo/design-system/components/ui/item";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { TableEmpty } from "@/components/shared/table/frame";
import { PostRow } from "@/components/tenant/classes/home/post";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { usePaginatedPreloaded } from "@/lib/data/paginated";

/** How many announcements the home reads each time the end of its list comes into view. */
const POST_PAGE_SIZE = 20;

/**
 * The home of a class: its announcements, newest first (ADR 0025). The next page loads when the
 * end of the list comes into view, so the list has no button. A class with no announcement shows
 * its empty state, a failed read its sentence and Try again, and a viewer who lost the school's
 * access is sent to the refused page.
 */
export function ClassHome() {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedPreloaded(
    classroom.posts.list,
    isSettled ? { classId, slug } : "skip",
    { initialNumItems: POST_PAGE_SIZE },
    Option.none()
  );
  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  if (PaginatedQueryResult.isFailure(pagination)) {
    return <DataFailure onRetry={reloadPage} />;
  }
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    return (
      <TableEmpty
        act="reading"
        description={t("posts-empty-description")}
        title={t("posts-empty")}
      />
    );
  }

  return (
    <>
      <ItemGroup aria-label={t("posts")} className="mx-auto max-w-3xl">
        {Arr.map(pagination.results, (post) => (
          <PostRow key={post.clientKey} post={post} />
        ))}
      </ItemGroup>
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(POST_PAGE_SIZE)} />
      ) : null}
    </>
  );
}
