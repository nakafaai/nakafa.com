import { buttonVariants } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { Heading } from "@repo/design-system/markdown/heading";
import { Paragraph } from "@repo/design-system/markdown/paragraph";
import { useTranslations } from "next-intl";
import { getGithubUrl } from "@/lib/utils/github";

export function ComingSoon({ className }: { className?: string }) {
  const t = useTranslations("ComingSoon");

  return (
    <div className={cn(className)} data-pagefind-ignore>
      <Heading className="text-2xl" Tag="h2">
        {t("title")}
      </Heading>

      <Paragraph className="text-foreground/80">{t("description")}</Paragraph>

      <a
        className={buttonVariants({ variant: "default" })}
        href={getGithubUrl({ path: "" })}
        rel="noopener noreferrer"
        target="_blank"
        title={t("contribute")}
      >
        {t("contribute")}
      </a>
    </div>
  );
}
