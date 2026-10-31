import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { Id } from "@repo/backend/confect/_generated/id";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import {
  PlayerHeader,
  PlayerHeaderEnd,
  PlayerHeaderStart,
  PlayerTitle,
} from "@/components/player/header";
import { ShellLock } from "@/components/sidebar/lock";
import { useTenant } from "@/components/tenant/context";
import { TargetLink } from "@/lib/routing/link";
import {
  schoolExamEditTarget,
  schoolHomeTarget,
} from "@/lib/routing/school/target";

/**
 * The header of a paper being answered, the try-out player's own: the way back and the exam's name at the
 * start, the time left in the centre when the paper has a deadline, and the view beside the one primary
 * action at the end. It locks the school's frame while the paper is on screen, so the paper takes the whole
 * screen and the school's navigation stays out of sight, as a running try-out does.
 */
export function PaperBar({
  back,
  children,
  timer,
  title,
}: {
  /** The way back, at the start of the row (`PaperBack`). */
  readonly back: ReactNode;
  /** The one primary action, at the end of the row. */
  readonly children?: ReactNode;
  /** The time left, in the centre of the row; none for a paper without a deadline. */
  readonly timer?: ReactNode;
  readonly title: string;
}) {
  return (
    <>
      <ShellLock />
      <PlayerHeader>
        <PlayerHeaderStart>
          {back}
          <PlayerTitle>{title}</PlayerTitle>
        </PlayerHeaderStart>
        {timer}
        <PlayerHeaderEnd>{children}</PlayerHeaderEnd>
      </PlayerHeader>
    </>
  );
}

/**
 * The way back from a paper, as the try-out player's back button: a student's leads to the school home,
 * and a teacher's try of an exam leads back to the exam's editor, where the try started.
 */
export function PaperBack({ examId }: { readonly examId?: Id<"exams"> }) {
  const tCommon = useTranslations("Common");
  const tenant = useTenant();

  return (
    <TargetLink
      aria-label={tCommon("back")}
      className={buttonVariants({ size: "icon", variant: "outline" })}
      target={
        examId === undefined
          ? schoolHomeTarget(tenant.slug)
          : schoolExamEditTarget(tenant.slug, examId)
      }
    >
      <HugeIcons icon={ArrowLeft01Icon} />
    </TargetLink>
  );
}
