import { useTranslations } from "next-intl";
import {
  BentoCard,
  BentoContent,
  BentoDescription,
  BentoFeature,
  BentoGrid,
  BentoStat,
  BentoVisual,
} from "@/components/marketing/about/components/bento";

export function Bento() {
  const t = useTranslations("Bento");

  return (
    <section
      className="scroll-mt-28 border-y bg-linear-to-t from-secondary/20 to-background py-24"
      id="features"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-6">
        <div className="grid gap-6">
          <h2 className="max-w-3xl text-balance font-semibold text-3xl tracking-tight sm:text-4xl">
            {t("title")}
          </h2>
          <p className="max-w-xl text-pretty text-lg text-muted-foreground md:text-xl">
            {t("description")}
          </p>
        </div>

        <BentoGrid>
          <BentoCard>
            <BentoVisual />
            <BentoContent>
              <BentoStat label={t("materials-label")} value="5,000+" />
              <BentoDescription>{t("materials-description")}</BentoDescription>
            </BentoContent>
          </BentoCard>

          <BentoCard>
            <BentoVisual />
            <BentoContent>
              <BentoStat label={t("exercises-label")} value="2,000+" />
              <BentoDescription>{t("exercises-description")}</BentoDescription>
            </BentoContent>
          </BentoCard>

          <BentoCard size="tall">
            <BentoVisual className="flex-1" />
            <BentoContent>
              <BentoFeature
                description={t("ai-description")}
                title={t("ai-title")}
              />
            </BentoContent>
          </BentoCard>

          <BentoCard size="wide">
            <BentoVisual />
            <BentoContent>
              <BentoStat label={t("subjects-label")} value="100+" />
              <BentoDescription>{t("subjects-description")}</BentoDescription>
            </BentoContent>
          </BentoCard>

          <div className="col-span-full grid grid-cols-1 gap-4 md:grid-cols-2">
            <BentoCard>
              <BentoVisual />
              <BentoContent>
                <BentoFeature
                  description={t("performance-description")}
                  title={t("performance-title")}
                />
              </BentoContent>
            </BentoCard>

            <BentoCard>
              <BentoVisual />
              <BentoContent>
                <BentoFeature
                  description={t("quality-description")}
                  title={t("quality-title")}
                />
              </BentoContent>
            </BentoCard>
          </div>
        </BentoGrid>
      </div>
    </section>
  );
}
