"use client";

import type { Ref } from "@confect/core";
import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr } from "effect";
import { useCallback, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/providers/convex";
import { DataFailure } from "@/components/shared/failure";
import { useAgeClock } from "@/components/user/clock.client";
import { FeedEmpty, FeedNotice } from "@/components/user/feed";
import { PostComposer } from "@/components/user/posts/composer";
import {
  failedView,
  livePostsArgs,
  type PostsView,
  postsView,
} from "@/components/user/posts/live";
import {
  PostDraftProvider,
  PostsProvider,
  usePostsContext,
} from "@/components/user/posts/provider";
import { PostRow } from "@/components/user/posts/row";
import type { PublicProfile } from "@/lib/profile/public";

/**
 * The posts of one profile, newest first. The first page comes from the server,
 * so it is on the screen before the browser connects, and the live list takes
 * its place with the same posts. The composer shows, and the More menus of the
 * rows, only when the viewer owns the profile. The actions wait until the live
 * list holds its first page, so every change made in the list shows at once.
 */
export function UserPosts({
  first,
  isOwner,
  now: serverNow,
  profile,
}: {
  /** The first page the server read, or none when that read failed, so the live list loads the page. */
  first: Ref.Returns<typeof posts.queries.list> | undefined;
  isOwner: boolean;
  now: number;
  profile: PublicProfile;
}) {
  const clock = useAgeClock(serverNow);
  // A Retry changes the key, which remounts the list so that it asks the server
  // again. The draft lives in the provider above the list, so it stays. The
  // boundary catches an error the list throws, so the header and the tabs stay
  // on the screen and the failure shows above the server's page.
  const [attempt, setAttempt] = useState(0);
  const onRetry = useCallback(() => setAttempt((count) => count + 1), []);

  return (
    <PostDraftProvider>
      <PostsProvider
        clock={clock}
        isOwner={isOwner}
        onRetry={onRetry}
        profile={profile}
      >
        <ErrorBoundary
          fallbackRender={() => (
            <PostsPanel view={failedView(first?.page ?? null)} />
          )}
          key={attempt}
        >
          <PostsFeed first={first} />
        </ErrorBoundary>
      </PostsProvider>
    </PostDraftProvider>
  );
}

/**
 * The live list of one profile. It asks for the posts once Convex has settled
 * the session, and `postsView` decides what it shows from the answer and the
 * server's first page.
 */
function PostsFeed({
  first,
}: {
  first: Ref.Returns<typeof posts.queries.list> | undefined;
}) {
  const { profile } = usePostsContext();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const live = usePaginatedQuery(
    posts.queries.list,
    livePostsArgs(profile._id, isSettled),
    { initialNumItems: POST_PAGE_SIZE }
  );

  return (
    <PostsPanel
      onLoadMore={
        PaginatedQueryResult.isCanLoadMore(live)
          ? () => live.loadMore(POST_PAGE_SIZE)
          : undefined
      }
      view={postsView(live, first?.page ?? null)}
    />
  );
}

/**
 * What the Posts tab shows, as its view decides it: the composer above for the
 * owner, the failure with its Retry, the rows, the empty sentence, and the next
 * page, which loads as the end of the rows comes near. The rows stay inert until
 * the list takes a change.
 */
function PostsPanel({
  onLoadMore,
  view,
}: {
  onLoadMore?: (() => void) | undefined;
  view: PostsView;
}) {
  const t = useTranslations("Posts");
  const { isOwner, onRetry, profile } = usePostsContext();

  return (
    <div className="flex flex-col">
      {isOwner && <PostComposer disabled={!view.ready} profile={profile} />}
      {view.failed && (
        <FeedNotice>
          <DataFailure onRetry={onRetry} />
        </FeedNotice>
      )}
      <div className="flex flex-col" inert={!view.ready}>
        {Arr.map(view.rows, (post) => (
          <PostRow key={post._id} post={post} />
        ))}
        {view.empty && <FeedEmpty>{t("empty")}</FeedEmpty>}
        {onLoadMore && <Intersection onIntersect={onLoadMore} />}
      </div>
    </div>
  );
}
