import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { Nina } from "@repo/design-system/components/ui/nina";
import { cva } from "class-variance-authority";
import { useTranslations } from "use-intl";
import { LetterSheet } from "@/components/marketing/about/letter/sheet";
import { Signature } from "@/components/marketing/about/letter/signature";
import { MarketingSection } from "@/components/marketing/shared/section";

/**
 * The promise in the note, under a highlighter stroke. The stroke sweeps from
 * the start of the words to their end once the note is seen, and stands still
 * with reduced motion. Each line of the promise carries its own stroke.
 */
const promiseVariants = cva(
  "bg-linear-to-r bg-size-[0%_100%] from-pop-yellow/45 to-pop-yellow/45 box-decoration-clone bg-no-repeat px-0.5 text-foreground transition-[background-size] delay-300 duration-700 ease-(--ease-in-out) group-data-seen/letter:bg-size-[100%_100%] motion-reduce:bg-size-[100%_100%] motion-reduce:transition-none"
);

/**
 * The founder's note: one letter, signed, written to the learner. The text is
 * approved, and Nina in a round tile stands for the founder. When the note
 * comes on screen, the promise is highlighted and the signature is written.
 */
export function Letter() {
  const t = useTranslations("Landing");

  return (
    <MarketingSection id="letter">
      <div className="mx-auto w-full max-w-2xl">
        <LetterSheet>
          <Card className="py-8 lg:py-10">
            <CardContent className="grid gap-5 text-pretty px-8 text-base lg:px-10">
              <p className="text-lg">{t("letter-hello")}</p>
              <p>{t("letter-student")}</p>
              <p>{t("letter-fair")}</p>
              <p>
                {t.rich("letter-free", {
                  mark: (chunks) => (
                    <mark className={promiseVariants()}>{chunks}</mark>
                  ),
                })}
              </p>
              <p>{t("letter-open")}</p>
              <p>{t("letter-slow")}</p>
              <div className="flex flex-wrap items-end justify-between gap-6 pt-4">
                <div className="flex items-center gap-4">
                  <Nina label="" size={64} tile="cream" />
                  <div className="grid">
                    <p className="font-medium">Nabil</p>
                    <p className="text-muted-foreground text-sm">
                      {t("letter-founder")}
                    </p>
                  </div>
                </div>
                <Signature label={t("letter-signature")} />
              </div>
            </CardContent>
          </Card>
        </LetterSheet>
      </div>
    </MarketingSection>
  );
}
