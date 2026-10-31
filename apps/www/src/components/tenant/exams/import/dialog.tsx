import { QueryResult, useQuery } from "@confect/react";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { Button } from "@repo/design-system/components/ui/button";
import { FieldGroup } from "@repo/design-system/components/ui/field";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Effect } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  useImportFile,
  useImportForm,
} from "@/components/tenant/exams/import/calls";
import { ImportFileField } from "@/components/tenant/exams/import/field";
import { useExam } from "@/components/tenant/exams/provider";
import { reportClientException } from "@/lib/analytics/client";

const SOURCE = "components/tenant/exams/import/dialog";

/** Says that a form is read through a Google Drive connection this account does not have. */
const toastNoDrive = () =>
  toast.error({
    description: "import-no-drive.description",
    title: "import-no-drive.title",
  });

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
  const importForm = useImportForm(slug);
  const offered = useQuery(connectors.google.offered, {});
  const [file, setFile] = useState<File | null>(null);
  const driveOn =
    QueryResult.isSuccess(offered) && Arr.contains(offered.value, "drive");

  return (
    <ResponsiveDialog
      description={t("import-dialog-description")}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            {common("cancel")}
          </Button>
          <Button
            disabled={file === null}
            onClick={() => {
              if (file === null) {
                return;
              }
              onOpenChange(false);
              Effect.runFork(importFile(exam.id, file));
            }}
          >
            {t("import-submit")}
          </Button>
        </>
      }
      // The dialog forgets its file once it has closed, so it opens empty again and the closing dialog
      // keeps showing the file it imports.
      onOpenChangeComplete={(next) => {
        if (!next) {
          setFile(null);
        }
      }}
      open={open}
      setOpen={onOpenChange}
      title={t("import-title")}
    >
      <FieldGroup>
        <ImportFileField
          description={t("import-hint")}
          file={file}
          onFile={setFile}
        />
        {driveOn ? (
          <Button
            onClick={() =>
              Effect.runFork(
                importForm(exam.id, () => onOpenChange(false)).pipe(
                  Effect.catchTags({
                    DriveMissing: () => Effect.sync(toastNoDrive),
                    FormDriveMissing: () => Effect.sync(toastNoDrive),
                  }),
                  Effect.catch((error) =>
                    reportClientException(error, { source: SOURCE }).pipe(
                      Effect.andThen(
                        Effect.sync(() =>
                          toast.error({
                            description: "import-unread.description",
                            title: "import-unread.title",
                          })
                        )
                      )
                    )
                  )
                )
              )
            }
            type="button"
            variant="outline"
          >
            {t("import-forms")}
          </Button>
        ) : null}
      </FieldGroup>
    </ResponsiveDialog>
  );
}
