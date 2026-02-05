import { useTranslations } from "next-intl";
import {
  BentoCard,
  BentoContent,
  BentoDescription,
  BentoFeature,
  BentoGrid,
  BentoStat,
  BentoVisual,
} from "./components/bento";

export function Bento() {
  const t = useTranslations("Bento");

  return (
    <section
      className="scroll-mt-28 border-border border-y py-24"
      id="features"
    >
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="mb-12 text-center">
          <h2 className="font-semibold text-3xl tracking-tight sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-muted-foreground">
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
            <BentoVisual className="lg:flex-1" />
            <BentoContent className="flex flex-col justify-center">
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
