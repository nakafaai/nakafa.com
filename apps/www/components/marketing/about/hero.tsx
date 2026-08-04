import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useLocale, useTranslations } from "next-intl";
import { HeroArt } from "@/components/marketing/about/hero-art";
import { getCurriculumIndexHref } from "@/lib/curriculum/routes";

/**
 * Introduces Nakafa through one readable learn, Tryout, and Nina story.
 *
 * The animated paper field stays decorative so the conversion path remains
 * semantic and independent from the visual treatment.
 */
export function Hero() {
  const t = useTranslations("About");
  const locale = useLocale();

  return (
    <section className="relative scroll-mt-28 overflow-hidden" id="hero">
      <div className="absolute inset-0 z-1">
        <HeroArt />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-7xl items-end px-6 pt-72 pb-20 sm:items-center sm:py-24 md:py-32 lg:px-10">
        <div className="relative z-2 max-w-3xl">
          <h1 className="fade-in slide-in-from-bottom-3 animation-duration-500 motion-reduce:slide-in-from-bottom-0 motion-reduce:animation-duration-200 mb-0 animate-in text-balance fill-mode-both font-medium text-5xl tracking-tight ease-[cubic-bezier(0.23,1,0.32,1)] sm:text-6xl md:text-7xl xl:text-8xl">
            {t.rich("title", {
              mark: (chunks) => <mark>{chunks}</mark>,
            })}
          </h1>

          <p className="fade-in slide-in-from-bottom-3 animation-duration-500 motion-reduce:slide-in-from-bottom-0 motion-reduce:animation-duration-200 mt-6 max-w-xl animate-in text-pretty fill-mode-both text-foreground/80 text-lg delay-75 ease-[cubic-bezier(0.23,1,0.32,1)] sm:text-xl">
            {t("description")}
          </p>

          <div className="fade-in slide-in-from-bottom-3 animation-duration-500 motion-reduce:slide-in-from-bottom-0 motion-reduce:animation-duration-200 mt-8 flex animate-in flex-wrap items-center gap-3 fill-mode-both delay-150 ease-[cubic-bezier(0.23,1,0.32,1)]">
            <Button
              nativeButton={false}
              render={
                <NavigationLink href={getCurriculumIndexHref(locale)}>
                  {t("explore-subjects")}
                  <HugeIcons icon={ArrowUpRight01Icon} />
                </NavigationLink>
              }
              size="lg"
            />
            <Button
              nativeButton={false}
              render={
                <NavigationLink href="/try-out">
                  {t("try-tryout")}
                </NavigationLink>
              }
              size="lg"
              variant="outline"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
