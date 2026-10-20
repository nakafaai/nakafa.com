import { Nina } from "@repo/design-system/components/ui/nina";
import { useTranslations } from "use-intl";
import { CurriculumList } from "@/components/marketing/about/curricula/list";
import { NINA_SLOT } from "@/components/marketing/about/toys/slot";
import { MarketingSection } from "@/components/marketing/shared/section";
import type { readRuntimeCurriculumOptions } from "@/lib/curriculum/model";

/**
 * The curricula part: a heading, then Nina pointing at the curricula of the
 * catalog, which the list lights up one at a time. The names come from the
 * catalog, so the page never names a class. On a phone, where the list stands
 * under the heading on its own, Nina is left out.
 */
export function Curricula({
  curricula,
}: {
  readonly curricula: ReturnType<typeof readRuntimeCurriculumOptions>;
}) {
  const t = useTranslations("Landing");

  return (
    <MarketingSection id="curricula">
      <div className="mx-auto grid w-full max-w-5xl justify-items-center gap-12">
        <h2 className="max-w-2xl text-balance text-center text-3xl tracking-tight sm:text-4xl">
          {t("curricula-title")}
        </h2>
        <div className="grid items-center gap-16 md:grid-cols-[auto_minmax(0,1fr)]">
          <div className="hidden md:block" id={NINA_SLOT.curricula}>
            <Nina act="pointing" label="" size={200} whole />
          </div>
          <CurriculumList curricula={curricula} label={t("curricula-list")} />
        </div>
      </div>
    </MarketingSection>
  );
}
