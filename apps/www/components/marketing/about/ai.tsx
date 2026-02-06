import {
  BookOpen02Icon,
  CodeIcon,
  CpuIcon,
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
    <div className="flex flex-col gap-4 p-6 first:pt-12 last:pb-12 lg:py-12">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
        <HugeIcons className="text-primary" icon={icon} />
      </div>
      <div className="grid gap-2">
        <h3 className="font-medium text-lg">{title}</h3>
        <p className="text-pretty text-muted-foreground">{description}</p>
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
      className="scroll-mt-28 border-b bg-linear-to-b from-card to-background"
      id="ai"
    >
      <div className="mx-auto w-full max-w-7xl border-x">
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

        <div className="flex flex-col overflow-hidden border-t bg-card text-card-foreground">
          <div className="grid gap-6 px-6 py-12 lg:grid-cols-2">
            <div className="flex flex-col justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
                  <HugeIcons className="text-primary" icon={CpuIcon} />
                </div>
                <span className="font-medium text-muted-foreground">
                  {t("feature-label")}
                </span>
              </div>
              <h3 className="font-medium text-2xl tracking-tight">
                {t.rich("feature-title", {
                  mark: (chunks) => <mark>{chunks}</mark>,
                })}
              </h3>
              <p className="text-pretty text-muted-foreground">
                {t("feature-description")}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-lg border bg-background">
              <div className="absolute inset-0">
                <AiNeuroNoise />
              </div>
              <div className="relative p-6">
                <div className="rounded-md bg-background p-4 font-mono text-sm shadow-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-primary">$</span>
                    <span className="truncate">
                      curl nakafa.com/en/subject/math/vector.md
                    </span>
                  </div>
                  <div className="mt-2 space-y-0.5 text-muted-foreground">
                    <div className="text-primary"># Nakafa Framework: LLM</div>
                    <div>## What Is a Vector?</div>
                    <div className="text-muted-foreground">
                      Imagine a weather map...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y border-t lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            <AudienceCard
              ctaHref="/"
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
