import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { Nina } from "@repo/design-system/components/ui/nina";
import { useTranslations } from "next-intl";
import { Signature } from "@/components/marketing/about/letter/signature";

/**
 * The founder's note: one letter, signed, written to the learner. The text is
 * approved, and Nina in a round tile stands for the founder.
 */
export function Letter() {
  const t = useTranslations("Landing");

  return (
    <section className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32" id="letter">
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <CardContent className="grid gap-5 text-pretty p-8 text-base lg:p-10">
            <p className="text-lg">{t("letter-hello")}</p>
            <p>{t("letter-student")}</p>
            <p>{t("letter-fair")}</p>
            <p>
              {t.rich("letter-free", {
                mark: (chunks) => <mark>{chunks}</mark>,
              })}
            </p>
            <p>{t("letter-open")}</p>
            <p>{t("letter-slow")}</p>
            <div className="flex flex-wrap items-end justify-between gap-6 pt-4">
              <div className="flex items-center gap-4">
                <div className="size-16 overflow-hidden rounded-full">
                  <Nina label="" size={64} tile="cream" />
                </div>
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
      </div>
    </section>
  );
}
