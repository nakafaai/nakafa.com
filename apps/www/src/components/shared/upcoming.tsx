import { LoveKoreanFingerIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { EmptyState } from "@/components/state/empty";
import { DeferredEmptyNina } from "@/components/state/mascot";
import { getGithubUrl } from "@/lib/content/repository";

/**
 * The body of a public page whose content is not written yet, as an empty state (`EmptyState`): Nina writing, its
 * heading, and the way to help write it. Nina arrives after the page's first JavaScript, in a place kept for her.
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
      scene={<DeferredEmptyNina act="writing" />}
      title={<h2>{t("title")}</h2>}
    />
  );
}
