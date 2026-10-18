"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "next-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useTenant } from "@/components/tenant/context";

/**
 * The one next step of a school's home (K27): the exams for whoever may open them,
 * else the invitations for whoever runs the school. There is no tour and no list of
 * tasks, and a viewer who can take neither step sees none.
 */
export function SchoolNextStep() {
  const { canManage, canOpenExams } = useTenant();
  if (canOpenExams) {
    return <SchoolNextStepCard href="/exams" step="exam" />;
  }
  if (canManage) {
    return <SchoolNextStepCard href="/settings/invites" step="invite" />;
  }
  return null;
}

/** One next step: what it is, why, and the one link that takes it. */
function SchoolNextStepCard({
  href,
  step,
}: {
  href: string;
  step: "exam" | "invite";
}) {
  const t = useTranslations("School");

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t(`next-${step}-title`)}</CardTitle>
        <CardDescription>{t(`next-${step}-description`)}</CardDescription>
      </CardHeader>
      <CardSectionFooter hint={t(`next-${step}-footer`)}>
        <CardSectionActions>
          <NavigationLink className={buttonVariants()} href={href}>
            {t(`next-${step}-action`)}
            <HugeIcons data-icon="inline-end" icon={ArrowRight02Icon} />
          </NavigationLink>
        </CardSectionActions>
      </CardSectionFooter>
    </CardSection>
  );
}
