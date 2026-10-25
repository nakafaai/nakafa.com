import { FileImportIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Effect } from "effect";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import { useImportFile } from "@/components/tenant/exams/import/calls";
import { IMPORT_ACCEPT } from "@/components/tenant/exams/import/file";
import { useExam } from "@/components/tenant/exams/provider";

/**
 * The editor's Import, as Google Slides imports slides and Canva uploads files into an open
 * design: a Word or PDF file whose questions Nina puts at the end of this exam. The dialog closes
 * at once and the questions appear in the editor as Nina reads them, with one toast that follows
 * the import. On a phone the button keeps its icon and its name for screen readers.
 */
export function ImportQuestions() {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const { exam, slug } = useExam();
  const importFile = useImportFile(slug);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const id = useId();

  /** Opens or closes the dialog. A closed dialog forgets its file, so it opens empty again. */
  const show = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setFile(null);
    }
  };

  return (
    <>
      <Button
        aria-label={t("import-action")}
        onClick={() => setOpen(true)}
        variant="outline"
      >
        <HugeIcons aria-hidden="true" icon={FileImportIcon} />
        <span className="max-sm:sr-only">{t("import-action")}</span>
      </Button>
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
          <Field>
            <FieldLabel htmlFor={`${id}-file`}>{t("import-label")}</FieldLabel>
            <Input
              accept={IMPORT_ACCEPT}
              id={`${id}-file`}
              onChange={(event) => setFile(event.target.files?.item(0) ?? null)}
              type="file"
            />
            <FieldDescription>{t("import-hint")}</FieldDescription>
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}
