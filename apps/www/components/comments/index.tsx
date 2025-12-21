"use client";

import { MessagesSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { CommentsAdd } from "./add";
import { CommentsList } from "./list";

interface Props {
  slug: string;
}

export function Comments({ slug }: Props) {
  const t = useTranslations("Common");

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
        <CommentsAdd slug={slug} />
        <CommentsList slug={slug} />
      </div>
    </section>
  );
}
