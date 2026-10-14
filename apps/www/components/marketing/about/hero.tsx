import { Button } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Nina } from "@repo/design-system/components/ui/nina";
import { useLocale, useTranslations } from "next-intl";
import { HeroField } from "@/components/marketing/about/hero/field.client";
import { getCurriculumIndexHref } from "@/lib/curriculum/routes";

/**
 * The first part of the home page: one sentence, two actions, and Nina reading
 * whole beside them. The particles drift behind the words, wait until the page
 * is painted, and rest once the hero is off screen.
 */
export function Hero() {
  const t = useTranslations("Landing");
  const locale = useLocale();

  return (
    <section
      className="relative isolate flex min-h-[calc(100svh-4rem)] scroll-mt-28 items-center overflow-hidden"
      id="hero"
    >
      <HeroField />
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-6 py-32 lg:grid-cols-2 lg:px-10">
        <div className="grid justify-items-start gap-8">
          <h1 className="text-balance text-[2.5rem] leading-tight tracking-tight md:text-[3rem] lg:text-[4rem]">
            {t.rich("hero-title", {
              mark: (chunks) => <mark>{chunks}</mark>,
            })}
          </h1>
          <p className="max-w-xl text-pretty text-muted-foreground text-xl">
            {t("hero-tag")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              nativeButton={false}
              render={
                <NavigationLink href={getCurriculumIndexHref(locale)}>
                  {t("hero-start")}
                </NavigationLink>
              }
              size="lg"
            />
            <Button
              nativeButton={false}
              render={
                <NavigationLink href="/try-out">
                  {t("hero-tryout")}
                </NavigationLink>
              }
              size="lg"
              variant="outline"
            />
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <Nina act="reading" label="" size={320} whole />
        </div>
      </div>
    </section>
  );
}
