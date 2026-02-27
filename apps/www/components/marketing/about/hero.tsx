import { LoveKoreanFingerIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { HeroCta } from "./hero.client";
import { HeroArt } from "./hero-art";

export function Hero() {
  const t = useTranslations("About");
  return (
    <section className="grid scroll-mt-28 items-center" id="hero">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-24">
        <h1 className="mb-0 max-w-3xl text-balance font-medium text-4xl tracking-tight md:text-5xl">
          {t.rich("title", {
            mark: (chunks) => <mark>{chunks}</mark>,
          })}
        </h1>
        <p className="max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl">
          {t("description")}
        </p>
        <div className="flex w-full max-w-lg items-center gap-4">
          <Button
            nativeButton={false}
            render={
              <a
                href="https://github.com/nakafaai/nakafa.com"
                rel="noopener noreferrer"
                target="_blank"
              >
                <HugeIcons icon={LoveKoreanFingerIcon} />
                {t("contribute")}
              </a>
            }
            variant="secondary"
          />
          <HeroCta />
        </div>
      </div>

      <div className="relative left-1/2 w-screen -translate-x-1/2">
        <HeroArt />
      </div>
    </section>
  );
}
