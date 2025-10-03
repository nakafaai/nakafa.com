"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Response } from "@repo/design-system/components/ai/response";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { usePaginatedQuery } from "convex/react";
import { MessagesSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { getInitialName } from "@/lib/utils/helper";
import { AddComment } from "./add";

type Props = {
  slug: string;
};

export function Comments({ slug }: Props) {
  const t = useTranslations("Common");
  const { results } = usePaginatedQuery(
    api.comments.queries.getParentCommentsBySlug,
    { slug },
    { initialNumItems: 25 }
  );

  return (
    <section className="space-y-6">
      <h2
        className="flex scroll-mt-28 items-center gap-2 font-medium text-2xl leading-tight tracking-tight"
        id="comments"
      >
        <MessagesSquareIcon className="size-5 shrink-0" />
        {t("comments")}
      </h2>
      <div className="flex flex-col gap-6">
        <AddComment slug={slug} />
        <div className="flex flex-col gap-4">
          {results.map((comment) => {
            const userName = comment.user?.name ?? "Unknown User";
            const userImage = comment.user?.image ?? "";

            return (
              <div
                className="flex items-start gap-4 text-left"
                key={comment._id}
              >
                <Avatar className="size-10 rounded-full">
                  <AvatarImage alt={userName} src={userImage} />
                  <AvatarFallback className="rounded-lg">
                    {getInitialName(userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium text-xs">
                    {userName}
                  </span>
                  <Response id={comment._id}>{comment.text}</Response>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
