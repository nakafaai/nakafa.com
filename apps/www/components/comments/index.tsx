"use client";

import { MessageMultiple01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
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
        <HugeIcons className="size-5" icon={MessageMultiple01Icon} />
        {t("comments")}
      </h2>
      <div className="flex flex-col gap-6">
        <CommentsAdd slug={slug} />
        <CommentsList slug={slug} />
      </div>
    </section>
  );
}
