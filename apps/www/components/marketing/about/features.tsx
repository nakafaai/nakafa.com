import { Dithering } from "@paper-design/shaders-react";
import { cn } from "@repo/design-system/lib/utils";
import * as motion from "motion/react-client";
import { useTranslations } from "next-intl";

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
    <motion.div
      className={cn("flex flex-col gap-1 px-6 py-8")}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.6,
            ease: "easeInOut",
          },
        },
      }}
    >
      <span className="font-semibold text-4xl tracking-tight">{value}</span>
      <span className="font-medium text-lg">{label}</span>
      <p className="text-muted-foreground text-sm">{description}</p>
    </motion.div>
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
      <div className="mx-auto w-full max-w-7xl px-6 py-24">
        <motion.h2
          className="mb-16 max-w-5xl text-pretty font-medium text-3xl tracking-tight sm:text-4xl"
          initial={{ opacity: 0, y: 20 }}
          transition={{
            duration: 0.6,
            ease: "easeInOut",
          }}
          viewport={{ once: true, margin: "-100px" }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          {t.rich("headline", {
            mark: (chunks) => <mark>{chunks}</mark>,
          })}
        </motion.h2>

        <div className="flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
            initial="hidden"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1,
                  delayChildren: 0.2,
                },
              },
            }}
            viewport={{ once: true, margin: "-100px" }}
            whileInView="visible"
          >
            {stats.map((stat) => (
              <FeatureStat
                description={stat.description}
                key={stat.label}
                label={stat.label}
                value={stat.value}
              />
            ))}
          </motion.div>

          <div className="h-112 w-full overflow-hidden">
            <Dithering
              className="size-full"
              colorBack="#00000000"
              colorFront="#f97316"
              scale={1.2}
              shape="warp"
              size={2}
              speed={0.15}
              type="4x4"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
