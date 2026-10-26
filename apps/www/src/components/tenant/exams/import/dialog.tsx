import { Button } from "@repo/design-system/components/ui/button";
import { FieldGroup } from "@repo/design-system/components/ui/field";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Effect } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useImportFile } from "@/components/tenant/exams/import/calls";
import { ImportFileField } from "@/components/tenant/exams/import/field";
import { useExam } from "@/components/tenant/exams/provider";

/**
 * The editor's Import, as Google Slides imports slides and Canva uploads files into an open
 * design: a Word or PDF file whose questions Nina puts at the end of this exam. The editor's menu
 * opens it (ExamMenu). The dialog closes at once and the questions appear in the editor as Nina
 * reads them, with one toast that follows the import.
 */
export function ImportQuestions({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const { exam, slug } = useExam();
  const importFile = useImportFile(slug);
  const [file, setFile] = useState<File | null>(null);

  /** Opens or closes the dialog. A closed dialog forgets its file, so it opens empty again. */
  const show = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setFile(null);
    }
  };

  return (
    <ResponsiveDialog
      description={t("import-dialog-description")}
      footer={
        <>
          <Button onClick={() => show(false)} variant="outline">
            {common("cancel")}
          </Button>
          <Button
            disabled={file === null}
            onClick={() => {
              if (file === null) {
                return;
              }
              show(false);
              Effect.runFork(importFile(exam.id, file));
            }}
          >
            {t("import-submit")}
          </Button>
        </>
      }
      open={open}
      setOpen={show}
      title={t("import-title")}
    >
      <FieldGroup>
        <ImportFileField
          description={t("import-hint")}
          file={file}
          onFile={setFile}
        />
      </FieldGroup>
    </ResponsiveDialog>
  );
}
