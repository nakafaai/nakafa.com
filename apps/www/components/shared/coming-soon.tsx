import { LoveKoreanFingerIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Heading } from "@repo/design-system/components/markdown/heading";
import { Paragraph } from "@repo/design-system/components/markdown/paragraph";
import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { getGithubUrl } from "@/lib/utils/github";

export function ComingSoon({ className }: { className?: string }) {
  const t = useTranslations("ComingSoon");

  return (
    <div className={cn(className)}>
      <Heading className="text-2xl" Tag="h2">
        {t("title")}
      </Heading>

      <Paragraph>{t("description")}</Paragraph>

      <Button
        render={
          <a
            href={getGithubUrl({ path: "" })}
            rel="noopener noreferrer"
            target="_blank"
          >
            <HugeIcons icon={LoveKoreanFingerIcon} />
            {t("contribute")}
          </a>
        }
      />
    </div>
  );
}
