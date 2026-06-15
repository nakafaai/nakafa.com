import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { getTranslations } from "next-intl/server";
import type { ActiveLearningProfile } from "@/components/programs/contract";

const HOME_PLAN_ITEM_LIMIT = 3;

type HomeLearningProfile = NonNullable<ActiveLearningProfile>;

/** Renders the active learning program and first plan items on the home page. */
export async function HomeLearningProgram({
  profile,
}: {
  profile: HomeLearningProfile;
}) {
  const t = await getTranslations("LearningPrograms");
  const visiblePlanItems = profile.planItems.slice(0, HOME_PLAN_ITEM_LIMIT);
  const interestLabels = profile.interests
    .map((interest) => t(`interest.${interest}.title`))
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{t("home-plan-title")}</CardTitle>
          <Badge variant="outline">
            {t(`program-status.${profile.program.coverageStatus}`)}
          </Badge>
        </div>
        <CardDescription>
          {t("home-plan-description", {
            interests: interestLabels,
            program: profile.program.title,
          })}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {visiblePlanItems.length > 0 ? (
          <ol className="grid gap-3">
            {visiblePlanItems.map((item) => (
              <li
                className="rounded-md border bg-muted/20 p-3"
                key={`${item.lensId}:${item.position}`}
              >
                <p className="font-medium text-sm">
                  {item.title ?? t("plan-item-untitled")}
                </p>
                <p className="mt-1 text-muted-foreground text-xs">
                  {t(`plan-item-status.${item.status}`)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground text-sm">
            {t("home-plan-empty")}
          </p>
        )}
      </CardContent>

      <CardFooter className="border-t">
        <Button
          className="h-11"
          nativeButton={false}
          render={
            <NavigationLink href="/onboarding">
              {t("home-plan-cta")}
              <HugeIcons data-icon="inline-end" icon={ArrowRight02Icon} />
            </NavigationLink>
          }
          variant="outline"
        />
      </CardFooter>
    </Card>
  );
}
