import type { StudentSittingRow } from "@repo/backend/confect/exams/sittings/contract";
import { ItemActions } from "@repo/design-system/components/ui/item";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { useHomeNow } from "@/components/tenant/home/clock";
import { minutesLeft } from "@/components/tenant/home/left";
import {
  HomeCard,
  HomeRow,
  HomeRowText,
  HomeSection,
} from "@/components/tenant/home/section";
import { schoolDayTimeText } from "@/components/tenant/settings/clock";
import { TargetLink } from "@/lib/routing/link";
import { schoolSittingTarget } from "@/lib/routing/school/target";

/** One sitting of the student, as the student's list holds it. */
type Sitting = typeof StudentSittingRow.Type;

/**
 * The student's exams in one card, in the order the student needs them: the sitting open now with its Start or
 * Continue, the sittings still to open with the day and time each opens, then the results of the sittings that closed,
 * newest first, with the student's score once it is released. A row opens its sitting.
 */
export function ExamsSection({
  finished,
  upcoming,
}: {
  /** The sittings that closed, newest first. */
  finished: readonly Sitting[];
  /** The sittings open now or still to open, in their opening order. */
  upcoming: readonly Sitting[];
}) {
  const t = useTranslations("School");

  return (
    <HomeSection title={t("home-exams")}>
      <HomeCard>
        {Arr.map(upcoming, (sitting) =>
          sitting.state === "open" ? (
            <OpenSitting key={sitting.id} sitting={sitting} />
          ) : (
            <NextSitting key={sitting.id} sitting={sitting} />
          )
        )}
        {Arr.map(finished, (sitting) => (
          <FinishedSitting key={sitting.id} sitting={sitting} />
        ))}
      </HomeCard>
    </HomeSection>
  );
}

/**
 * The sitting that is open now, with the minutes it has left and the action that enters it: Start before the student
 * has an attempt, and Continue once the student has one. A student whose answers are saved sees that instead of an
 * action. The action is the row's one link, so the row holds no link inside another.
 */
function OpenSitting({ sitting }: { sitting: Sitting }) {
  const { slug } = useTenant();
  const t = useTranslations("School");
  const te = useTranslations("Exams");
  const tCommon = useTranslations("Common");
  const now = useHomeNow();
  const submitted = sitting.attempt === "submitted";

  return (
    <HomeRow>
      <HomeRowText
        detail={sitting.room}
        title={sitting.examTitle}
        when={t("home-minutes-left", {
          count: minutesLeft(sitting.closesAt, now),
        })}
      />
      <ItemActions>
        {submitted ? (
          <span className="text-muted-foreground text-sm">
            {t("answers-saved")}
          </span>
        ) : (
          <TargetLink
            className={buttonVariants({ size: "sm" })}
            target={schoolSittingTarget(slug, sitting.id)}
          >
            {sitting.attempt === null
              ? te("student-start")
              : tCommon("continue")}
          </TargetLink>
        )}
      </ItemActions>
    </HomeRow>
  );
}

/** A sitting still to open, as a row that opens it, with the day and time it opens in its unit's time zone. */
function NextSitting({ sitting }: { sitting: Sitting }) {
  const { slug } = useTenant();
  const locale = useLocale();

  return (
    <HomeRow
      render={<TargetLink target={schoolSittingTarget(slug, sitting.id)} />}
    >
      <HomeRowText
        detail={sitting.room}
        title={sitting.examTitle}
        when={schoolDayTimeText({
          at: sitting.opensAt,
          locale,
          timeZone: sitting.timeZone,
        })}
      />
    </HomeRow>
  );
}

/** A sitting that closed, as a row that opens it, with the student's score once it is released. */
function FinishedSitting({ sitting }: { sitting: Sitting }) {
  const { slug } = useTenant();
  const t = useTranslations("School");
  const te = useTranslations("Exams");

  return (
    <HomeRow
      render={<TargetLink target={schoolSittingTarget(slug, sitting.id)} />}
    >
      <HomeRowText
        detail={sitting.room}
        title={sitting.examTitle}
        when={
          sitting.score === null
            ? t("answers-saved")
            : te("student-score", {
                points: sitting.score.points,
                total: sitting.score.total,
              })
        }
      />
    </HomeRow>
  );
}
