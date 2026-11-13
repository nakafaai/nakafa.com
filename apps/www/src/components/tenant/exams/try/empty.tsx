import type { Id } from "@repo/backend/confect/_generated/id";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { PageState } from "@/components/shared/page/body";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
import { useTenant } from "@/components/tenant/context";
import { Link } from "@/lib/routing/link";

/**
 * The body of a try of an exam that holds no question yet: one way on, to the editor where the
 * first question goes, as the page's one state (`PageState`). The player has nothing to number, flag or move
 * between.
 */
export function ExamTryEmpty({ examId }: { examId: Id<"exams"> }) {
  const { slug } = useTenant();
  const t = useTranslations("Exams");

  return (
    <PageState>
      <EmptyState
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
        scene={<EmptyNina act="writing" />}
        title={t("try-empty-title")}
      />
    </PageState>
  );
}
