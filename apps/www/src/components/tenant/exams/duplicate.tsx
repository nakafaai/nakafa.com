import type { GenericId } from "@confect/core";
import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { ExamTitle } from "@repo/backend/confect/exams/exam";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useNavigate } from "@tanstack/react-router";
import { Effect, Function as Fn, Schema, String as Str } from "effect";
import { use, useTransition } from "react";
import { useTranslations } from "use-intl";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import { CreatedExamsContext } from "@/components/tenant/exams/created";

/** The title of a duplicate, the original's alone when the suffix would not fit the field. */
const duplicateTitle = (title: string, words: string) => {
  const titled = Str.trim(`${title} ${words}`);
  return Schema.is(ExamTitle)(titled) ? titled : Str.trim(title);
};

/**
 * Copies an exam and opens the copy, which takes changes however the exam it came from stands. A copy of a long exam
 * takes a moment, so the press says it started, and the editor draws the copy at once, as it draws a new exam.
 */
export function useDuplicateExam(
  exam: {
    readonly id: GenericId.GenericId<"exams">;
    readonly title: string;
  },
  slug: TenantSlug
) {
  const t = useTranslations("Exams");
  const created = use(CreatedExamsContext);
  const navigate = useNavigate();
  const duplicate = useMutation(exams.exams.duplicate);
  const [isPending, startTransition] = useTransition();

  const press = () => {
    toast.info({ title: "exam-copying.title" });
    startTransition(() =>
      runExamAction(
        sentAction(() =>
          duplicate({
            examId: exam.id,
            slug,
            title: duplicateTitle(exam.title, t("duplicate-suffix")),
          })
        ).pipe(
          Effect.tap((saved) =>
            Effect.sync(() => {
              created?.getState().hold(saved);
              navigate({
                params: { exam: saved.id, slug },
                to: "/school/$slug/exams/$exam/edit",
              });
            })
          )
        ),
        { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
      )
    );
  };

  return { isPending, press };
}
