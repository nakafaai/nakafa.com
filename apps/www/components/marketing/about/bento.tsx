import {
  Dithering,
  GrainGradient,
  SimplexNoise,
  Voronoi,
  Warp,
} from "@paper-design/shaders-react";
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
            <BentoVisual>
              <Voronoi
                className="absolute inset-0"
                colorGap="#2e0000"
                colorGlow="#ffffff"
                colors={["#ff8247", "#ffe53d"]}
                distortion={0.4}
                fit="cover"
                gap={0.01}
                glow={0}
                maxPixelCount={1920 * 1080}
                minPixelRatio={1}
                scale={0.5}
                speed={0.5}
                stepsPerColor={3}
              />
            </BentoVisual>
            <BentoContent>
              <BentoStat label={t("materials-label")} value="5000+" />
              <BentoDescription>{t("materials-description")}</BentoDescription>
            </BentoContent>
          </BentoCard>

          <BentoCard>
            <BentoVisual>
              <SimplexNoise
                className="absolute inset-0"
                colors={["#ff8247", "#ffb347", "#ffe53d", "#ff6b35"]}
                scale={0.6}
                softness={0.3}
                speed={0.5}
                stepsPerColor={2}
              />
            </BentoVisual>
            <BentoContent>
              <BentoStat label={t("exercises-label")} value="2000+" />
              <BentoDescription>{t("exercises-description")}</BentoDescription>
            </BentoContent>
          </BentoCard>

          <BentoCard size="tall">
            <BentoVisual className="flex-1">
              <GrainGradient
                className="absolute inset-0"
                colorBack="#1a0f00"
                colors={["#ff8247", "#ffb347", "#ffe53d", "#ff6b35"]}
                intensity={0.6}
                noise={0.2}
                shape="corners"
                softness={0.4}
                speed={0.8}
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
              <Warp
                className="absolute inset-0"
                colors={["#ff8247", "#ffb347", "#ffe53d", "#ff6b35"]}
                distortion={0.25}
                proportion={0.05}
                rotation={44}
                scale={1.2}
                shape="checks"
                shapeScale={0.28}
                softness={0.2}
                speed={0.5}
                swirl={0.8}
                swirlIterations={10}
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
                  colorBack="#1a0f00"
                  colorFront="#ff8247"
                  shape="sphere"
                  size={2.5}
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
                <Voronoi
                  className="absolute inset-0"
                  colorGap="#1a0f00"
                  colorGlow="#ffe53d"
                  colors={["#ff8247", "#ffb347"]}
                  distortion={0.3}
                  fit="cover"
                  gap={0.02}
                  glow={0.2}
                  maxPixelCount={1920 * 1080}
                  minPixelRatio={1}
                  scale={0.6}
                  speed={0.3}
                  stepsPerColor={2}
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
