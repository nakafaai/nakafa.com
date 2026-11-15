import { Target02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useSearch } from "@tanstack/react-router";
import { Option } from "effect";
import { useTranslations } from "use-intl";
import { PageHeaderLabel } from "@/components/shared/page/header";
import {
  getTryoutPracticeTarget,
  PRACTICE_SEARCH,
} from "@/components/tryout/route/path";
import { TargetLink } from "@/lib/routing/link";

/**
 * Opens the practice of the set or the section a page shows (ADR 0044), from its header beside the try-out's
 * own action. A reader who is not signed in comes back here once they are.
 */
export function TryoutPracticeLink({ publicPath }: { publicPath: string }) {
  const t = useTranslations("Tryouts");

  return Option.match(getTryoutPracticeTarget(publicPath), {
    onNone: () => null,
    onSome: (target) => (
      <TargetLink
        className={buttonVariants({ variant: "outline" })}
        data-slot="button"
        target={target}
      >
        <HugeIcons icon={Target02Icon} />
        <PageHeaderLabel>{t("practice-cta")}</PageHeaderLabel>
      </TargetLink>
    ),
  });
}

/** Whether the page's address opens its practice in place of its try-out. */
export function useTryoutPracticing() {
  return useSearch({
    select: (search) => search.mode === PRACTICE_SEARCH.mode,
    strict: false,
  });
}
