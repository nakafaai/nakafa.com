"use client";

import type { Ref } from "@confect/core";
import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { Button } from "@repo/design-system/components/ui/button";
import { Array as Arr, DateTime } from "effect";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { DataFailure } from "@/components/shared/failure";
import { PostComposer } from "@/components/user/posts/composer";
import { postsView } from "@/components/user/posts/live";
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
  // A Retry changes the key, which remounts the live list so that it asks the
  // server again. The draft lives in the provider above the list, so it stays.
  const [attempt, setAttempt] = useState(0);

  return (
    <PostDraftProvider>
      <PostsFeed
        account={account}
        author={author}
        first={first}
        key={attempt}
        now={now}
        onRetry={() => setAttempt((count) => count + 1)}
      />
    </PostDraftProvider>
  );
}

/**
 * The live list of one profile, with the owner's composer above it and the
 * failure above the rows. A failure keeps the rows the list holds, and its Retry
 * remounts this part to ask the server anew.
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
  const t = useTranslations("Posts");
  const live = usePaginatedQuery(
    posts.queries.list,
    { authorId: account.appUser._id },
    { initialNumItems: POST_PAGE_SIZE }
  );
  const view = postsView(live, first?.page ?? null);

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
        {PaginatedQueryResult.isCanLoadMore(live) && (
          <div className="flex justify-center">
            <Button
              onClick={() => live.loadMore(POST_PAGE_SIZE)}
              variant="outline"
            >
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
