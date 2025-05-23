import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Heading } from "../markdown/heading";
import { Paragraph } from "../markdown/paragraph";
import { buttonVariants } from "../ui/button";

const GITHUB_URL = process.env.GITHUB_URL;

export function ComingSoon({ className }: { className?: string }) {
  const t = useTranslations("ComingSoon");

  return (
    <div data-pagefind-ignore className={cn(className)}>
      <Heading Tag="h2" className="text-2xl">
        {t("title")}
      </Heading>

      <Paragraph>{t("description")}</Paragraph>

      <a
        href={GITHUB_URL}
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
