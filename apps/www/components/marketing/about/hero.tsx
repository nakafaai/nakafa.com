import {
  ArrowUpRight01Icon,
  LoveKoreanFingerIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";
import { HeroArt } from "./hero-art";

export function Hero() {
  const t = useTranslations("About");
  return (
    <section className="grid scroll-mt-28 items-center" id="hero">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 pt-24 pb-12">
        <h1 className="mb-0 max-w-2xl text-balance font-semibold text-4xl tracking-tighter md:text-5xl">
          {t.rich("title", {
            mark: (chunks) => <mark>{chunks}</mark>,
          })}
        </h1>
        <p className="max-w-xl text-pretty text-lg text-muted-foreground md:text-xl">
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
          <Button
            nativeButton={false}
            render={
              <NavigationLink href="/">
                <HugeIcons icon={ArrowUpRight01Icon} />
                {t("start-learning")}
              </NavigationLink>
            }
          />
        </div>
      </div>

      <div className="relative left-1/2 w-screen -translate-x-1/2">
        <HeroArt />
      </div>
    </section>
  );
}
