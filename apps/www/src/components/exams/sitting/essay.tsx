import { ESSAY_RESPONSE_MAX } from "@repo/backend/confect/assessment/response";
import type * as AnswerEditorModule from "@repo/design-system/components/editor/answer";
import { EditorPane } from "@repo/design-system/components/editor/pane";
import { plainText } from "@repo/design-system/components/editor/plain";
import { toast } from "@repo/design-system/lib/toast/notify";
import { type ComponentProps, type ReactNode, Suspense, use } from "react";
import { useTranslations } from "use-intl";
import { usePaperLocked } from "@/components/exams/sitting/lock";
import { memoizeLoad } from "@/lib/chunks/load";
import { useAnswerLabels } from "@/lib/editor/labels";

/** Loads the answer editor, with its formula field, at its dynamic boundary, so a paper without an essay never loads it. */
const loadAnswerEditor = memoizeLoad(
  () => import("@repo/design-system/components/editor/answer")
);

/**
 * An essay's answer, written as a paper leaves room to write: the words with their marks and lists, and the formulas
 * the student writes with the exam editor's formula editor and keypad, kept as Markdown that the results draw with
 * their formulas. Its editor (`SittingEssayEditor`) loads its code as the essay shows, and the written words hold
 * its place until then, in the same frame, so nothing moves when it arrives.
 */
export function SittingEssay({
  children,
  fallback,
}: {
  /** The essay's editor. */
  children: ReactNode;
  /** The written words (`SittingEssayWords`), which hold the editor's place while its code loads. */
  fallback: ReactNode;
}) {
  return (
    <div
      className="flex min-h-56 flex-col overflow-hidden rounded-md border"
      data-slot="essay"
    >
      <Suspense fallback={fallback}>{children}</Suspense>
    </div>
  );
}

/** The answer editor of an essay, once its code has loaded. A locked paper shows the words read only. */
export function SittingEssayEditor(
  props: Pick<
    ComponentProps<typeof AnswerEditorModule.AnswerEditor>,
    "labelledBy" | "onBlur" | "onChange" | "saved" | "text"
  >
) {
  const { AnswerEditor } = use(loadAnswerEditor());
  const t = useTranslations("Exams");
  const labels = useAnswerLabels();
  const locked = usePaperLocked();

  return (
    <AnswerEditor
      {...props}
      labels={labels}
      limit={ESSAY_RESPONSE_MAX}
      locked={locked}
      onRefuse={() => toast.error({ title: "essay-too-long.title" })}
      placeholder={t("essay-placeholder")}
    />
  );
}

/** The written words as plain text, in the frame the editor takes, while its code loads. */
export function SittingEssayWords({ text }: { text: string }) {
  const words = plainText(text);

  return (
    <EditorPane>
      <p dir="auto">{words === "" ? <br /> : words}</p>
    </EditorPane>
  );
}
