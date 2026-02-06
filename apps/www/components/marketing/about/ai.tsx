import {
  BookOpen02Icon,
  CodeIcon,
  StudentIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { AiNeuroNoise } from "./ai.client";

interface AudienceCardProps {
  icon: React.ComponentProps<typeof HugeIcons>["icon"];
  title: string;
  description: string;
  ctaText: string;
  ctaHref: string;
}

function AudienceCard({
  icon,
  title,
  description,
  ctaText,
  ctaHref,
}: AudienceCardProps) {
  return (
    <div className="flex flex-col gap-4 border-t p-6 first:border-t first:border-l-0 lg:border-t-0 lg:border-l">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <HugeIcons className="text-primary" icon={icon} />
      </div>
      <div className="grid gap-2">
        <h3 className="font-medium text-lg">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="mt-auto pt-2">
        <Button
          nativeButton={false}
          render={
            <a href={ctaHref} rel="noopener noreferrer" target="_blank">
              {ctaText}
            </a>
          }
          size="sm"
          variant="secondary"
        />
      </div>
    </div>
  );
}

export function Ai() {
  const t = useTranslations("AiSection");

  return (
    <section
      className="scroll-mt-28 border-y bg-linear-to-b from-card to-background"
      id="ai"
    >
      <div className="mx-auto w-full max-w-7xl border-x">
        {/* Header */}
        <div className="grid gap-6 px-6 pt-24 pb-12 lg:grid-cols-2 lg:gap-12">
          <h2 className="max-w-3xl text-balance font-medium text-3xl tracking-tight sm:text-4xl">
            {t.rich("headline", {
              mark: (chunks) => <mark>{chunks}</mark>,
            })}
          </h2>
          <p className="max-w-xl text-pretty text-lg text-muted-foreground">
            {t("description")}
          </p>
        </div>

        {/* Feature Card with NeuroNoise */}
        <div className="flex flex-col overflow-hidden border-t bg-card text-card-foreground">
          <div className="grid gap-6 p-6 lg:grid-cols-2 lg:p-12">
            <div className="flex flex-col justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
                  <HugeIcons className="text-primary" icon={CodeIcon} />
                </div>
                <span className="font-medium text-muted-foreground text-sm">
                  {t("feature-label")}
                </span>
              </div>
              <h3 className="font-medium text-2xl tracking-tight">
                {t("feature-title")}
              </h3>
              <p className="text-muted-foreground">
                {t("feature-description")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="font-semibold">5,000+</span>
                  <span className="text-muted-foreground">
                    {" "}
                    {t("stat-pages")}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">100%</span>
                  <span className="text-muted-foreground">
                    {" "}
                    {t("stat-markdown")}
                  </span>
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-lg border bg-background">
              <div className="absolute inset-0 opacity-60">
                <AiNeuroNoise />
              </div>
              <div className="relative p-6">
                <div className="rounded-md bg-background/90 p-4 font-mono text-sm shadow-sm backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-green-500">$</span>
                    <span>
                      curl https://nakafa.com/en/subject/math/llms.txt
                    </span>
                  </div>
                  <div className="mt-2 text-muted-foreground">
                    <span className="text-blue-500">
                      # Nakafa Framework: LLM
                    </span>
                    <br />
                    <span># URL: https://nakafa.com/en/subject/math</span>
                    <br />
                    <span># Source: github.com/nakafaai/nakafa.com</span>
                    <br />
                    <span>---</span>
                    <br />
                    <span>## Mathematics</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Three Audience Cards */}
          <div className="grid grid-cols-1 border-t md:grid-cols-3">
            <AudienceCard
              ctaHref="https://nakafa.com"
              ctaText={t("cta-students")}
              description={t("students-description")}
              icon={StudentIcon}
              title={t("students-title")}
            />
            <AudienceCard
              ctaHref="/llms.txt"
              ctaText={t("cta-developers")}
              description={t("developers-description")}
              icon={CodeIcon}
              title={t("developers-title")}
            />
            <AudienceCard
              ctaHref="mailto:nakafaai@gmail.com"
              ctaText={t("cta-schools")}
              description={t("schools-description")}
              icon={BookOpen02Icon}
              title={t("schools-title")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
