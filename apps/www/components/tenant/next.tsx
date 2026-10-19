"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useTenant } from "@/components/tenant/context";

/**
 * The one next step of a school's home: the exams, for whoever may open them. There is
 * no tour and no list of tasks, and a viewer who may not open exams sees none. Every
 * viewer who runs the school may open them too, so the exams are the step for them as
 * well. The link is a plain one, because a school host has no locale in its paths.
 */
export function SchoolNextStep() {
  const t = useTranslations("School");
  const { canOpenExams } = useTenant();
  if (!canOpenExams) {
    return null;
  }

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("next-exam-title")}</CardTitle>
        <CardDescription>{t("next-exam-description")}</CardDescription>
      </CardHeader>
      <CardSectionFooter hint={t("next-exam-footer")}>
        <CardSectionActions>
          <Link className={buttonVariants()} href="/exams">
            {t("next-exam-action")}
            <HugeIcons data-icon="inline-end" icon={ArrowRight02Icon} />
          </Link>
        </CardSectionActions>
      </CardSectionFooter>
    </CardSection>
  );
}
