import { getGithubUrl } from "@/lib/utils/github";
import { buttonVariants } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { Heading } from "@repo/design-system/markdown/heading";
import { Paragraph } from "@repo/design-system/markdown/paragraph";
import { useTranslations } from "next-intl";

export function ComingSoon({ className }: { className?: string }) {
  const t = useTranslations("ComingSoon");

  return (
    <div data-pagefind-ignore className={cn(className)}>
      <Heading Tag="h2" className="text-2xl">
        {t("title")}
      </Heading>

      <Paragraph>{t("description")}</Paragraph>

      <a
        href={getGithubUrl({ path: "" })}
        title={t("contribute")}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "default" })}
      >
        {t("contribute")}
      </a>
    </div>
  );
}
