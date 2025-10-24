import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";

type Props = {
  className?: string;
};

export function HomeTitle({ className }: Props) {
  const t = useTranslations("Home");

  return (
    <h1
      className={cn(
        "mb-8 font-medium text-4xl leading-none tracking-tighter md:text-center",
        className
      )}
    >
      {t("title")}
    </h1>
  );
}
