import type { Id } from "@repo/backend/confect/_generated/id";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { PlayerHeaderEnd } from "@/components/player/header";
import { OfflineNote } from "@/components/shared/offline";
import { PageHeader } from "@/components/shared/page/header";
import { ShellLock } from "@/components/sidebar/lock";
import { useTenant } from "@/components/tenant/context";
import { SchoolPath } from "@/components/tenant/header";
import {
  schoolExamEditTarget,
  schoolExamsTarget,
  schoolSittingsTarget,
} from "@/lib/routing/school/target";

/**
 * The header of a paper being answered, as the try-out player's (`PageHeader`): the paper's path from the
 * school's home at the start, the time left in the centre when the paper has a deadline, and the one primary action
 * at the end, beside the note that the answers wait while the connection is gone. A student's paper leads back to the
 * student's exams; a teacher's try of an exam leads back to the exam's editor, where the try started. It locks the
 * school's frame while the paper is on screen, so the sidebar steps into its exam mode, as a running try-out's does.
 */
export function PaperBar({
  children,
  examId,
  timer,
  title,
}: {
  /** The one primary action, at the end of the row. */
  readonly children?: ReactNode;
  /** The exam a teacher tries; none for a student's paper. */
  readonly examId?: Id<"exams">;
  /** The time left, in the centre of the row; none for a paper without a deadline. */
  readonly timer?: ReactNode;
  readonly title: string;
}) {
  const t = useTranslations("Exams");
  const { slug } = useTenant();

  return (
    <>
      <ShellLock />
      <PageHeader title={title}>
        <SchoolPath
          items={
            examId === undefined
              ? [
                  { label: t("title"), target: schoolSittingsTarget(slug) },
                  { label: title },
                ]
              : [
                  { label: t("title"), target: schoolExamsTarget(slug) },
                  { label: title, target: schoolExamEditTarget(slug, examId) },
                  { label: t("try-action") },
                ]
          }
        />
        {timer}
        <PlayerHeaderEnd>
          <OfflineNote />
          {children}
        </PlayerHeaderEnd>
      </PageHeader>
    </>
  );
}
