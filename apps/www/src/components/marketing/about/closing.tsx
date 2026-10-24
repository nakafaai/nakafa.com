import { Button } from "@repo/design-system/components/ui/button";
import { Nina } from "@repo/design-system/components/ui/nina";
import { Thing } from "@repo/design-system/components/ui/thing";
import type { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { ClosingQuestion } from "@/components/marketing/about/closing/question";
import { NINA_SLOT } from "@/components/marketing/about/toys/slot";
import { MarketingSection } from "@/components/marketing/shared/section";
import { Link } from "@/lib/routing/link";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";

/**
 * The last part before the footer: a question that types its own topics, the
 * same two actions as the hero, and Nina playing ball.
 */
export function Closing() {
  const t = useTranslations("Landing");
  const topics: Arr.NonEmptyReadonlyArray<string> = [
    t("closing-topic-0"),
    t("closing-topic-1"),
    t("closing-topic-2"),
    t("closing-topic-3"),
    t("closing-topic-4"),
  ];

  return (
    <MarketingSection id="closing">
      <div className="mx-auto grid w-full max-w-4xl justify-items-center gap-10 text-center">
        <ClosingQuestion template={t.raw("closing-ask")} topics={topics} />
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            nativeButton={false}
            render={<Link to="/$locale/curricula">{t("hero-start")}</Link>}
            size="lg"
            variant="secondary"
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
        <div className="relative flex items-end justify-center">
          <span className="inline-block" id={NINA_SLOT.closing}>
            <Nina act="juggling" label="" size={240} whole />
          </span>
          <Thing className="absolute -end-4 bottom-4" name="balls" size={48} />
        </div>
      </div>
    </MarketingSection>
  );
}
