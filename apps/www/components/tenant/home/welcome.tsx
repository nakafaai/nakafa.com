"use client";

import { QueryResult } from "@confect/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, DateTime, Option } from "effect";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { useTenant } from "@/components/tenant/context";
import {
  DAY_PART_ACT,
  dayPartAt,
  firstNameOf,
} from "@/components/tenant/home/greeting";
import { useHomeViewer } from "@/components/tenant/home/query.client";

/**
 * The act of Nina before the school's clock is known: she does nothing in particular, so her pose never
 * changes after the first draw of a page that loads.
 */
const NEUTRAL_ACT = "relaxed";

/**
 * The welcome of the school home: a greeting for the part of the day on the school's clock, with the
 * viewer's first name, and Nina doing what fits that part of the day. The first unit of the school
 * gives the clock, and a school with no unit reads the UTC clock. Nina keeps the neutral act until the
 * viewer loads, because the clock is known only then. Its footer holds the one sentence of the card,
 * with the one next step for a viewer who may open exams. The greeting keeps its line while the
 * viewer's name loads, so the tile does not move.
 */
export function WelcomeTile({ className }: { className?: string }) {
  const t = useTranslations("School");
  const tenant = useTenant();
  const viewer = useHomeViewer();
  const part = QueryResult.isSuccess(viewer)
    ? dayPartAt(
        DateTime.nowUnsafe(),
        Option.flatMap(Arr.head(viewer.value.units), (unit) =>
          DateTime.zoneMakeNamed(unit.timeZone)
        )
      )
    : null;

  return (
    <CardSection className={className}>
      <CardHeader>
        <CardTitle className="min-h-6">
          {QueryResult.isSuccess(viewer) && part !== null
            ? t(`greeting-${part}`, {
                name: firstNameOf(viewer.value.person.name),
              })
            : null}
        </CardTitle>
      </CardHeader>
      <div className="px-6">
        <Nina
          act={part === null ? NEUTRAL_ACT : DAY_PART_ACT[part]}
          label=""
          size={96}
          whole
        />
      </div>
      {tenant.canOpenExams ? (
        <CardSectionFooter hint={t("next-exam-footer")}>
          <CardSectionActions>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/exams"
            >
              {t("next-exam-action")}
              <HugeIcons data-icon="inline-end" icon={ArrowRight02Icon} />
            </Link>
          </CardSectionActions>
        </CardSectionFooter>
      ) : (
        <CardSectionFooter hint={t("welcome-footer")} />
      )}
    </CardSection>
  );
}
