"use client";

import type { Ref } from "@confect/core";
import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { Button } from "@repo/design-system/components/ui/button";
import { Array as Arr, DateTime } from "effect";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { DataFailure } from "@/components/shared/failure";
import { PostComposer } from "@/components/user/posts/composer";
import { holdsFirstPage } from "@/components/user/posts/live";
import { PostRow } from "@/components/user/posts/row";
import { POST_PAGE_SIZE } from "@/components/user/posts/state";
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
  const t = useTranslations("Posts");
  const identity = useViewer((state) => state);
  const now = usePostsNow(serverNow);
  // Until the browser knows the viewer, the account the server read stands for
  // the viewer, because the profile opens only for its owner.
  const viewer = identity.isPending ? account : identity.account;
  const author = viewer ?? account;
  const isAuthor = viewer?.appUser._id === account.appUser._id;
  const live = usePaginatedQuery(
    posts.queries.list,
    { authorId: account.appUser._id },
    { initialNumItems: POST_PAGE_SIZE }
  );
  const ready = holdsFirstPage(live);
  const loading = PaginatedQueryResult.isLoadingFirstPage(live);
  const rows = loading ? (first?.page ?? []) : live.results;
  // A list that loads without a server page shows nothing yet, because the
  // empty sentence would claim that the learner has no posts.
  const showsEmpty = rows.length === 0 && (!loading || first !== null);

  return (
    <div className="flex flex-col">
      {isAuthor && <PostComposer appUser={author.appUser} disabled={!ready} />}
      <div className="flex flex-col" inert={!ready}>
        {PaginatedQueryResult.isFailure(live) && rows.length === 0 && (
          <DataFailure />
        )}
        {rows.length > 0 && (
          <div className="flex flex-col">
            {Arr.map(rows, (post, index) => (
              <PostRow
                author={author}
                isAuthor={isAuthor}
                isLast={index === rows.length - 1}
                key={post._id}
                now={now}
                post={post}
              />
            ))}
          </div>
        )}
        {showsEmpty && (
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
