import { NoteEditIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Option } from "effect";
import { useTranslations } from "use-intl";
import { PaneBody, PaneHeader } from "@/components/shared/pane";
import { PanesDetail, PaneTarget, usePanes } from "@/components/shared/panes";
import { useActiveQuestion } from "@/components/tenant/exams/provider";

/**
 * The second screen of the editor, the shared panes' always-on detail: beside the canvas on a wide
 * screen, the points, the key, the rubric, and the explanation of the chosen question, and the same
 * in the phone's sheet, which the footer opens. The canvas holds only what the student reads, so all
 * that the teacher alone sees stands here. The chosen page draws its layer into the detail's target
 * through `PanePortal`, so the page keeps one writer for its options and its key.
 */
export function ExamPanel() {
  const t = useTranslations("Exams");
  const active = useActiveQuestion();

  return (
    <PanesDetail label={t("teacher-layer")}>
      <PaneHeader
        description={Option.match(active, {
          onNone: () => undefined,
          onSome: (page) => t("question", { number: page.index + 1 }),
        })}
        title={t("teacher-layer")}
      />
      <PaneBody>
        <PaneTarget />
      </PaneBody>
    </PanesDetail>
  );
}

/** The footer's action that opens the teacher layer in a sheet on a phone, where no panel shows. */
export function ExamPanelButton() {
  const t = useTranslations("Exams");
  const open = usePanes((state) => state.sheet);
  const showSheet = usePanes((state) => state.showSheet);

  return (
    <Button
      aria-pressed={open}
      className="lg:hidden"
      onClick={showSheet}
      size="sm"
      type="button"
      variant="ghost"
    >
      <HugeIcons aria-hidden="true" icon={NoteEditIcon} />
      {t("teacher-layer")}
    </Button>
  );
}
