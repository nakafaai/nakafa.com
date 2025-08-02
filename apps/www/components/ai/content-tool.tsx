import type { GetContentOutput } from "@repo/ai/schema/tools";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { cn } from "@repo/design-system/lib/utils";
import { Link } from "@repo/internationalization/src/navigation";
import { BookIcon, ExternalLinkIcon, FrownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  output?: GetContentOutput;
} & ComponentProps<"div">;

export function ContentTool({ status, className, output, ...props }: Props) {
  const t = useTranslations("Ai");

  let icon = <SpinnerIcon className="size-4 shrink-0" />;
  if (status === "output-available") {
    icon = <BookIcon className="size-4 shrink-0" />;
  }
  if (status === "output-error") {
    icon = <FrownIcon className="size-4 shrink-0 text-destructive" />;
  }

  return (
    <div
      className={cn(
        "relative my-4 rounded-md border bg-card px-3 py-2 shadow-xs first:mt-0 last:mb-0",
        className
      )}
      {...props}
    >
      {output && (
        <Link
          className="absolute inset-0 cursor-pointer"
          href={output.url}
          target="_blank"
          type="button"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <p className="font-medium text-sm">{t("get-content")}</p>
        </div>
        {output && <ExternalLinkIcon className="size-4" />}
      </div>
    </div>
  );
}
