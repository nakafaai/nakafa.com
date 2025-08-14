"use client";

import type { GetContentOutput } from "@repo/ai/schema/tools";
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@repo/design-system/components/ai/tool";
import { BookOpenIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { memo } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  output?: GetContentOutput;
};

export const ContentTool = memo(({ status, output }: Props) => {
  const t = useTranslations("Ai");

  return (
    <Tool>
      <ToolHeader
        icon={<BookOpenIcon className="size-4 text-muted-foreground" />}
        state={status}
        type={t("get-content")}
      />
      <ToolContent>
        <div className="p-3">
          <Link
            className="flex items-center gap-1 text-muted-foreground text-sm underline-offset-4 hover:underline"
            href={output?.url ?? ""}
            target="_blank"
          >
            <span className="max-w-48 truncate sm:max-w-64">{output?.url}</span>
            <ExternalLinkIcon className="ml-1 size-3.5 shrink-0" />
          </Link>
        </div>
      </ToolContent>
    </Tool>
  );
});
ContentTool.displayName = "ContentTool";
