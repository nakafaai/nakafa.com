import type { Id } from "@repo/backend/confect/_generated/id";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { TableEmpty } from "@/components/shared/table/frame";
import { useTenant } from "@/components/tenant/context";
import { Link } from "@/lib/routing/link";

/**
 * The body of a try of an exam that holds no question yet: one way on, to the editor where the
 * first question goes. The player has nothing to number, flag or move between.
 */
export function ExamTryEmpty({ examId }: { examId: Id<"exams"> }) {
  const { slug } = useTenant();
  const t = useTranslations("Exams");

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <TableEmpty
        act="writing"
        action={
          <Link
            className={buttonVariants()}
            params={{ exam: examId, slug }}
            to="/school/$slug/exams/$exam/edit"
          >
            {t("add-question")}
          </Link>
        }
        description={t("try-empty-description")}
        title={t("try-empty-title")}
      />
    </main>
  );
}
