import { Button } from "@repo/design-system/components/ui/button";
import { Nina } from "@repo/design-system/components/ui/nina";
import { useTranslations } from "use-intl";
import { HERO_NINA_ID } from "@/components/marketing/about/hero/id";
import { Link } from "@/lib/routing/link";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";

/**
 * The first part of the home page, in the middle of the screen: one sentence,
 * the line under it, two actions, and Nina reading whole below them. The
 * particles drift behind the words, wait until the page is painted, and rest
 * once the hero is off screen. The animals around the title and the things
 * around Nina are toys of the page, placed beside `HERO_NINA_ID`.
 */
export function Hero() {
  const t = useTranslations("Landing");

  return (
    <section
      className="relative isolate flex min-h-[min(calc(100svh-4rem),57.5rem)] scroll-mt-28 items-center overflow-hidden"
      id="hero"
    >
      <div className="relative mx-auto grid w-full max-w-3xl justify-items-center gap-6 px-6 pt-28 pb-16 text-center md:pt-24">
        <h1 className="text-balance text-[2.5rem] leading-[1.05] tracking-tight md:text-[3rem] lg:text-[4rem]">
          {t.rich("hero-title", {
            mark: (chunks) => <mark>{chunks}</mark>,
          })}
        </h1>
        <p className="max-w-md text-pretty text-lg text-muted-foreground md:text-xl">
          {t("hero-tag")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            nativeButton={false}
            render={<Link to="/$locale/curricula">{t("hero-start")}</Link>}
            size="lg"
          />
          <Button
            nativeButton={false}
            render={
              <Link activeOptions={EXACT_ACTIVE_OPTIONS} to="/$locale/try-out">
                {t("hero-tryout")}
              </Link>
            }
            size="lg"
            variant="outline"
          />
        </div>
        <div className="mt-6" id={HERO_NINA_ID}>
          <Nina act="reading" label="" size={240} whole />
        </div>
      </div>
    </section>
  );
}
