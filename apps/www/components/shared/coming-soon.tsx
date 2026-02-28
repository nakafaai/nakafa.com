import { LoveKoreanFingerIcon } from "@hugeicons/core-free-icons";
import { Heading } from "@repo/design-system/components/markdown/heading";
import { Paragraph } from "@repo/design-system/components/markdown/paragraph";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { getGithubUrl } from "@/lib/utils/github";

export function ComingSoon({ className }: { className?: string }) {
  const t = useTranslations("ComingSoon");

  return (
    <div className={cn(className)} data-pagefind-ignore>
      <Heading className="text-2xl" Tag="h2">
        {t("title")}
      </Heading>

      <Paragraph>{t("description")}</Paragraph>

      <Button
        nativeButton={false}
        render={
          <a
            href={getGithubUrl({ path: "" })}
            rel="noopener noreferrer"
            target="_blank"
            title={t("contribute")}
          >
            <HugeIcons icon={LoveKoreanFingerIcon} />
            {t("contribute")}
          </a>
        }
      />
    </div>
  );
}
