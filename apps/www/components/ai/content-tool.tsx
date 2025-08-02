import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { cn } from "@repo/design-system/lib/utils";
import { BookIcon, FrownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

type Props = {
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
} & ComponentProps<"div">;

export function ContentTool({ status, className, ...props }: Props) {
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
        "my-4 rounded-lg border bg-card px-3 py-2 shadow-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-medium text-sm">{t("get-content")}</p>
      </div>
    </div>
  );
}
