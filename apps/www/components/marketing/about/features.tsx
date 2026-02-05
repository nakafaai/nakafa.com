import { Dithering } from "@paper-design/shaders-react";
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

export function Features() {
  const t = useTranslations("Features");

  return (
    <section className="scroll-mt-28 border-y py-24" id="features">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-6">
        <h2 className="max-w-5xl text-pretty font-medium text-3xl tracking-tight sm:text-4xl">
          {t.rich("headline", {
            mark: (chunks) => <mark>{chunks}</mark>,
          })}
        </h2>

        <BentoGrid>
          <BentoCard>
            <BentoVisual>
              <Dithering
                className="absolute inset-0"
                colorBack="#18181b"
                colorFront="#f97316"
                originY={0.7}
                scale={0.9}
                shape="wave"
                size={3}
                speed={0.2}
                type="4x4"
              />
            </BentoVisual>
            <BentoContent>
              <BentoStat label={t("materials-label")} value="5000+" />
              <BentoDescription>{t("materials-description")}</BentoDescription>
            </BentoContent>
          </BentoCard>

          <BentoCard>
            <BentoVisual>
              <Dithering
                className="absolute inset-0"
                colorBack="#18181b"
                colorFront="#14b8a6"
                scale={0.6}
                shape="ripple"
                size={4}
                speed={0.25}
                type="8x8"
              />
            </BentoVisual>
            <BentoContent>
              <BentoStat label={t("exercises-label")} value="2000+" />
              <BentoDescription>{t("exercises-description")}</BentoDescription>
            </BentoContent>
          </BentoCard>

          <BentoCard size="tall">
            <BentoVisual>
              <Dithering
                className="absolute inset-0"
                colorBack="#18181b"
                colorFront="#f97316"
                scale={0.8}
                shape="swirl"
                size={2}
                speed={0.15}
                type="4x4"
              />
            </BentoVisual>
            <BentoContent>
              <BentoFeature
                description={t("ai-description")}
                title={t("ai-title")}
              />
            </BentoContent>
          </BentoCard>

          <BentoCard size="wide">
            <BentoVisual>
              <Dithering
                className="absolute inset-0"
                colorBack="#18181b"
                colorFront="#f59e0b"
                scale={1.1}
                shape="warp"
                size={2}
                speed={0.3}
                type="4x4"
              />
            </BentoVisual>
            <BentoContent>
              <BentoStat label={t("subjects-label")} value="100+" />
              <BentoDescription>{t("subjects-description")}</BentoDescription>
            </BentoContent>
          </BentoCard>

          <div className="col-span-full grid grid-cols-1 gap-4 md:grid-cols-2">
            <BentoCard>
              <BentoVisual>
                <Dithering
                  className="absolute inset-0"
                  colorBack="#18181b"
                  colorFront="#14b8a6"
                  originY={1}
                  scale={0.7}
                  shape="sphere"
                  size={3}
                  speed={0.2}
                  type="4x4"
                />
              </BentoVisual>
              <BentoContent>
                <BentoFeature
                  description={t("performance-description")}
                  title={t("performance-title")}
                />
              </BentoContent>
            </BentoCard>

            <BentoCard>
              <BentoVisual>
                <Dithering
                  className="absolute inset-0"
                  colorBack="#18181b"
                  colorFront="#f97316"
                  scale={0.8}
                  shape="simplex"
                  size={2}
                  speed={0.18}
                  type="8x8"
                />
              </BentoVisual>
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
