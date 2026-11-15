import { Search01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";

/** The search of a wide header: a button drawn as the search field it opens, with its icon and its words. */
export function QuranSurahSearchField(props: ComponentProps<"button">) {
  const t = useTranslations("Holy");
  return (
    <Button
      {...props}
      className="text-muted-foreground w-56 justify-start font-normal xl:w-64"
      variant="outline"
    >
      <HugeIcons icon={Search01Icon} />
      {t("search-surah")}
    </Button>
  );
}

/** The search of a phone's header: its icon alone, which its tooltip names. */
export function QuranSurahSearchIcon(props: ComponentProps<"button">) {
  const t = useTranslations("Holy");
  return (
    <Button
      {...props}
      size="icon"
      tooltip={t("search-surah")}
      variant="outline"
    >
      <HugeIcons icon={Search01Icon} />
    </Button>
  );
}
