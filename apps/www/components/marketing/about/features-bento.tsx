import type { IconSvgElement } from "@hugeicons/react";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { FeaturesNina } from "@/components/marketing/about/features-practice";
import { FeaturesProjectile } from "@/components/marketing/about/features-projectile";
import { FeaturesSubjectsArt } from "@/components/marketing/about/features-subjects-art";
import { FeaturesTryout } from "@/components/marketing/about/features-tryout";
import { SubjectItem } from "@/components/shared/subject-item";
import { SubjectList } from "@/components/shared/subject-list";

interface SubjectPath {
  href: string;
  icon: IconSvgElement;
  title: string;
}

interface FeaturesBentoProps {
  subjectPaths: readonly SubjectPath[];
  tryoutCountries: FunctionReturnType<
    typeof api.tryouts.queries.catalog.getHubPage
  >["countries"];
}

/** Composes four independent Nakafa learning moments into one bordered grid. */
export function FeaturesBento({
  subjectPaths,
  tryoutCountries,
}: FeaturesBentoProps) {
  const t = useTranslations("Features");

  return (
    <div className="relative grid grid-cols-1 overflow-hidden border-t bg-background text-foreground lg:grid-cols-12">
      <div className="relative min-h-[38rem] overflow-hidden border-b bg-background lg:col-span-7 lg:min-h-[40rem] lg:border-r">
        <FeaturesSubjectsArt />
        <div className="relative z-1 flex min-h-[38rem] flex-col gap-12 p-8 lg:min-h-[40rem] lg:p-10">
          <h3 className="max-w-2xl text-balance text-3xl tracking-tight sm:text-4xl">
            {t.rich("subjects-title", {
              mark: (chunks) => <mark>{chunks}</mark>,
            })}
          </h3>
          <SubjectList
            aria-label={t("subjects-navigation")}
            className="mt-auto w-full max-w-lg"
          >
            {subjectPaths.map((path) => (
              <SubjectItem
                href={path.href}
                icon={path.icon}
                key={path.href}
                label={path.title}
                labelElement="span"
              />
            ))}
          </SubjectList>
        </div>
      </div>

      <FeaturesTryout countries={tryoutCountries} />
      <FeaturesNina />
      <FeaturesProjectile />
    </div>
  );
}
