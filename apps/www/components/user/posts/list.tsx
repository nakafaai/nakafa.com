"use client";

import type { Ref } from "@confect/core";
import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { Button } from "@repo/design-system/components/ui/button";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Array as Arr, DateTime } from "effect";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { StoreApi } from "zustand";
import { useConvexAuth } from "@/components/providers/convex";
import { DataFailure } from "@/components/shared/failure";
import { AGE_TICK_MILLISECONDS } from "@/components/user/age";
import { FeedEmpty, FeedMore, FeedNotice } from "@/components/user/feed";
import {
  createPostsClock,
  type PostsClock,
} from "@/components/user/posts/clock";
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
import { type CurrentUser, useViewer } from "@/lib/identity/client";

/**
 * The posts of one profile, newest first. The first page comes from the server,
 * so it is on the screen before the browser connects, and the live list takes
 * its place with the same posts. The profile opens only for its owner, so the
 * owner's composer and More menus show whenever the viewer is the author. The
 * actions wait until the live list holds its first page, so every change made
 * in the list shows at once.
 */
export function UserPosts({
  account,
  first,
  now: serverNow,
}: {
  account: CurrentUser;
  /** The first page the server read, or none when that read failed, so the live list loads the page. */
  first: Ref.Returns<typeof posts.queries.list> | null;
  now: number;
}) {
  const identity = useViewer((state) => state);
  // Until the browser knows the viewer, the account the server read stands for
  // the viewer, because the profile opens only for its owner.
  const viewer = identity.isPending ? account : identity.account;
  const author =
    viewer && viewer.appUser._id === account.appUser._id ? viewer : null;
  const [clock] = useState(() => createPostsClock(serverNow));
  useAgeTimer(clock);
  // A Retry changes the key, which remounts the list so that it asks the server
  // again. The draft lives in the provider above the list, so it stays. The
  // boundary catches an error the list throws, so the header and the tabs stay
  // on the screen and the failure shows above the server's page.
  const [attempt, setAttempt] = useState(0);
  const onRetry = useCallback(() => setAttempt((count) => count + 1), []);

  return (
    <PostDraftProvider>
      <PostsProvider
        account={account}
        author={author}
        clock={clock}
        onRetry={onRetry}
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
 * The live list of one profile. It asks for the author's posts once Convex
 * confirms the session, and `postsView` decides what it shows from the answer
 * and the server's first page.
 */
function PostsFeed({
  first,
}: {
  first: Ref.Returns<typeof posts.queries.list> | null;
}) {
  const { account } = usePostsContext();
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const live = usePaginatedQuery(
    posts.queries.list,
    livePostsArgs(account.appUser._id, isAuthenticated),
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
 * What the owner's Posts tab shows, as its view decides it: the composer above,
 * the failure with its Retry, the rows, the empty sentence, and the next page.
 * The rows stay inert until the list takes a change.
 */
function PostsPanel({
  onLoadMore,
  view,
}: {
  onLoadMore?: (() => void) | undefined;
  view: PostsView;
}) {
  const t = useTranslations("Posts");
  const { author, onRetry } = usePostsContext();

  return (
    <div className="flex flex-col">
      {author && (
        <PostComposer appUser={author.appUser} disabled={!view.ready} />
      )}
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
        {onLoadMore && (
          <FeedMore>
            <Button onClick={onLoadMore} variant="outline">
              {t("load-more")}
            </Button>
          </FeedMore>
        )}
      </div>
    </div>
  );
}

/**
 * Moves the clock of the ages to the browser's time at once, and then on each
 * tick, so an age keeps up with the time after the server wrote it.
 */
function useAgeTimer(clock: StoreApi<PostsClock>) {
  useEffect(() => {
    const tick = () =>
      clock.getState().setNow(DateTime.toEpochMillis(DateTime.nowUnsafe()));
    tick();
    const timer = window.setInterval(tick, AGE_TICK_MILLISECONDS);
    return () => window.clearInterval(timer);
  }, [clock]);
}
