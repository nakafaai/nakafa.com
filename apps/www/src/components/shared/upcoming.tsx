import { LoveKoreanFingerIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { EmptyState } from "@/components/state/empty";
import { getGithubUrl } from "@/lib/content/repository";

/**
 * The body of a public page whose content is not written yet, as an empty state (`EmptyState`): its heading, and the
 * way to help write it. It shows no scene, since a public page keeps Nina's code out of its first JavaScript.
 */
export function ComingSoon() {
  const t = useTranslations("ComingSoon");

  return (
    <EmptyState
      action={
        <a
          className={buttonVariants()}
          href={getGithubUrl({ path: "" })}
          rel="noopener noreferrer"
          target="_blank"
        >
          <HugeIcons icon={LoveKoreanFingerIcon} />
          {t("contribute")}
        </a>
      }
      title={<h2>{t("title")}</h2>}
    />
  );
}
