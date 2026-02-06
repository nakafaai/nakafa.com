import { useTranslations } from "next-intl";
import { FeaturesDithering } from "@/components/marketing/about/features.client";

function FeatureStat({
  value,
  label,
  description,
}: {
  value: string;
  label: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1 p-6">
      <span className="font-semibold text-4xl tracking-tight">{value}</span>
      <span className="font-medium text-lg">{label}</span>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

export function Features() {
  const t = useTranslations("Features");

  const stats = [
    {
      value: t("materials-value"),
      label: t("materials-label"),
      description: t("materials-description"),
    },
    {
      value: t("exercises-value"),
      label: t("exercises-label"),
      description: t("exercises-description"),
    },
    {
      value: t("subjects-value"),
      label: t("subjects-label"),
      description: t("subjects-description"),
    },
    {
      value: t("ai-value"),
      label: t("ai-label"),
      description: t("ai-description"),
    },
  ];

  return (
    <section
      className="scroll-mt-28 border-y bg-linear-to-t from-card to-background"
      id="features"
    >
      <div className="mx-auto w-full max-w-7xl border-x">
        <h2 className="mb-16 max-w-5xl text-pretty px-6 pt-24 font-medium text-3xl tracking-tight sm:text-4xl">
          {t.rich("headline", {
            mark: (chunks) => <mark>{chunks}</mark>,
          })}
        </h2>

        <div className="flex flex-col overflow-hidden border-t bg-card text-card-foreground">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <FeatureStat
                description={stat.description}
                key={stat.label}
                label={stat.label}
                value={stat.value}
              />
            ))}
          </div>

          <div className="h-120 w-full overflow-hidden">
            <FeaturesDithering />
          </div>
        </div>
      </div>
    </section>
  );
}
