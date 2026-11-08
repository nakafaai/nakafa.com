import { Nina } from "@repo/design-system/components/ui/nina";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { Link } from "@/lib/routing/link";

/**
 * The first screen of the School landing, as the learner's home opens: one
 * sentence, the line under it, the free trial as the page's one primary action,
 * and Nina teaching at her board below.
 */
export function SchoolHero() {
  const t = useTranslations("SchoolSite");

  return (
    <section
      className="relative isolate flex min-h-[min(calc(100svh-4rem),57.5rem)] scroll-mt-28 items-center overflow-hidden"
      id="hero"
    >
      <div className="relative mx-auto grid w-full max-w-3xl justify-items-center gap-6 px-6 pt-28 pb-16 text-center md:pt-24">
        <h1 className="text-[2.5rem] leading-[1.05] tracking-tight text-balance md:text-[3rem] lg:text-[4rem]">
          {t.rich("hero-title", {
            mark: (chunks) => <mark>{chunks}</mark>,
          })}
        </h1>
        <p className="text-muted-foreground max-w-md text-lg text-pretty md:text-xl">
          {t("hero-lead")}
        </p>
        <Link
          className={buttonVariants({ size: "lg" })}
          to="/$locale/school/new"
        >
          {t("hero-start")}
        </Link>
        <div className="mt-6">
          <Nina act="teaching" label="" size={240} whole />
        </div>
      </div>
    </section>
  );
}
