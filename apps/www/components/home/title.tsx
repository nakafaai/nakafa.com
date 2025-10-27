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
        "mb-8 text-pretty text-center font-medium text-4xl leading-none tracking-tighter",
        className
      )}
    >
      <span className="hidden md:inline">{t("title")}</span>
      <span className="inline md:hidden">Nakafa</span>
    </h1>
  );
}
