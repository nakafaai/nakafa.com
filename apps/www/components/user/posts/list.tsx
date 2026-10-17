"use client";

import type { Ref } from "@confect/core";
import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { Button } from "@repo/design-system/components/ui/button";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { DataFailure } from "@/components/shared/failure";
import { PostComposer } from "@/components/user/posts/composer";
import { PostRow } from "@/components/user/posts/row";
import { POST_PAGE_SIZE } from "@/components/user/posts/state";
import { type CurrentUser, useViewer } from "@/lib/identity/client";

/**
 * The posts of one profile, newest first. The first page comes from the server,
 * so it is on the screen before the browser connects, and the live list takes
 * its place with the same posts. The profile opens only for its owner, so the
 * owner's composer and More menus show whenever the viewer is the author.
 */
export function UserPosts({
  account,
  first,
  now,
}: {
  account: CurrentUser;
  first: Ref.Returns<typeof posts.queries.list>;
  now: number;
}) {
  const t = useTranslations("Posts");
  const identity = useViewer((state) => state);
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
  const rows = PaginatedQueryResult.isLoadingFirstPage(live)
    ? first.page
    : live.results;

  return (
    <div className="flex flex-col">
      {isAuthor && <PostComposer appUser={author.appUser} />}
      {PaginatedQueryResult.isFailure(live) && rows.length === 0 && (
        <DataFailure />
      )}
      {rows.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm">
          {t("empty")}
        </p>
      ) : (
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
  );
}
