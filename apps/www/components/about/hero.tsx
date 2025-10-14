import { BlockArt } from "@repo/design-system/components/ui/block-art";
import { Button } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { ArrowUpRightIcon, HeartHandshakeIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function Hero() {
  const t = useTranslations("About");
  return (
    <section className="grid scroll-mt-28 items-center gap-12" id="hero">
      <div className="grid gap-6">
        <h1 className="mb-0 max-w-2xl text-balance font-semibold text-4xl tracking-tighter md:text-5xl">
          {t("title")}
        </h1>
        <p className="max-w-xl text-pretty text-lg text-muted-foreground md:text-xl">
          {t("description")}
        </p>
        <div className="flex w-full max-w-lg items-center gap-4">
          <Button asChild variant="secondary">
            <Link href="https://github.com/nakafaai/nakafa.com" target="_blank">
              <HeartHandshakeIcon />
              {t("contribute")}
            </Link>
          </Button>
          <Button asChild>
            <NavigationLink href="/">
              <ArrowUpRightIcon />
              {t("start-learning")}
            </NavigationLink>
          </Button>
        </div>
      </div>

      <div className="relative">
        <BlockArt className="border-x" />
      </div>
    </section>
  );
}
