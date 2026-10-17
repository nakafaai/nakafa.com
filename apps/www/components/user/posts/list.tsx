"use client";

import type { Ref } from "@confect/core";
import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { Button } from "@repo/design-system/components/ui/button";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Array as Arr, DateTime } from "effect";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useConvexAuth } from "@/components/providers/convex";
import { DataFailure } from "@/components/shared/failure";
import { PostComposer } from "@/components/user/posts/composer";
import {
  failedView,
  livePostsArgs,
  type PostsView,
  postsView,
} from "@/components/user/posts/live";
import { PostDraftProvider } from "@/components/user/posts/provider";
import { PostRow } from "@/components/user/posts/row";
import { AGE_TICK_MILLISECONDS } from "@/components/user/posts/time";
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
  const now = usePostsNow(serverNow);
  // Until the browser knows the viewer, the account the server read stands for
  // the viewer, because the profile opens only for its owner.
  const viewer = identity.isPending ? account : identity.account;
  const author =
    viewer && viewer.appUser._id === account.appUser._id ? viewer : null;
  // A Retry changes the key, which remounts the list so that it asks the server
  // again. The draft lives in the provider above the list, so it stays. The
  // boundary catches an error the list throws, so the header and the tabs stay
  // on the screen and the failure shows above the server's page.
  const [attempt, setAttempt] = useState(0);
  const onRetry = () => setAttempt((count) => count + 1);

  return (
    <PostDraftProvider>
      <ErrorBoundary
        fallbackRender={() => (
          <PostsPanel
            account={account}
            author={author}
            now={now}
            onRetry={onRetry}
            view={failedView(first?.page ?? null)}
          />
        )}
        key={attempt}
      >
        <PostsFeed
          account={account}
          author={author}
          first={first}
          now={now}
          onRetry={onRetry}
        />
      </ErrorBoundary>
    </PostDraftProvider>
  );
}

/**
 * The live list of one profile. It asks for the author's posts once Convex
 * confirms the session, and `postsView` decides what it shows from the answer
 * and the server's first page.
 */
function PostsFeed({
  account,
  author,
  first,
  now,
  onRetry,
}: {
  account: CurrentUser;
  /** The signed-in account when it is the profile's owner, which may write posts. */
  author: CurrentUser | null;
  first: Ref.Returns<typeof posts.queries.list> | null;
  now: number;
  onRetry: () => void;
}) {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const live = usePaginatedQuery(
    posts.queries.list,
    livePostsArgs(account.appUser._id, isAuthenticated),
    { initialNumItems: POST_PAGE_SIZE }
  );

  return (
    <PostsPanel
      account={account}
      author={author}
      now={now}
      onLoadMore={
        PaginatedQueryResult.isCanLoadMore(live)
          ? () => live.loadMore(POST_PAGE_SIZE)
          : undefined
      }
      onRetry={onRetry}
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
  account,
  author,
  now,
  onLoadMore,
  onRetry,
  view,
}: {
  account: CurrentUser;
  /** The signed-in account when it is the profile's owner, which may write posts. */
  author: CurrentUser | null;
  now: number;
  onLoadMore?: (() => void) | undefined;
  onRetry: () => void;
  view: PostsView;
}) {
  const t = useTranslations("Posts");

  return (
    <div className="flex flex-col">
      {author && (
        <PostComposer appUser={author.appUser} disabled={!view.ready} />
      )}
      {view.failed && <DataFailure onRetry={onRetry} />}
      <div className="flex flex-col" inert={!view.ready}>
        {view.rows.length > 0 && (
          <div className="flex flex-col">
            {Arr.map(view.rows, (post, index) => (
              // The rows show the profile's own account, never the signed-in
              // viewer, so a row does not depend on who is looking at it.
              <PostRow
                author={account}
                isAuthor={author !== null}
                isLast={index === view.rows.length - 1}
                key={post._id}
                now={now}
                post={post}
              />
            ))}
          </div>
        )}
        {view.empty && (
          <p className="text-center text-muted-foreground text-sm">
            {t("empty")}
          </p>
        )}
        {onLoadMore && (
          <div className="flex justify-center">
            <Button onClick={onLoadMore} variant="outline">
              {t("load-more")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The moment the ages count from. It starts at the moment the server read the
 * page, so the browser writes the words the server wrote, and then it reads the
 * browser's clock on every tick, so an age keeps up with the time.
 */
function usePostsNow(serverNow: number) {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const tick = () => setNow(DateTime.toEpochMillis(DateTime.nowUnsafe()));
    tick();
    const timer = window.setInterval(tick, AGE_TICK_MILLISECONDS);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}
