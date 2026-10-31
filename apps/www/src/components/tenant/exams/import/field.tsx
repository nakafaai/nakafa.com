import {
  Cancel01Icon,
  FileAttachmentIcon,
  FileUploadIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";

/**
 * The file field of an exam, as Google Docs takes an upload: one area that a teacher drops a
 * file on, or presses to choose one. Once a file is chosen, the area names it with a
 * way to remove it, at the same height, so the hint under it never moves. The file input covers the area without being seen, so it takes the press and
 * the dropped file itself, a keyboard reaches it, a screen reader reads its label, and the area
 * shows its focus.
 */
export function ImportFileField({
  accept,
  description,
  drop,
  file,
  label,
  onFile,
}: {
  /** The kinds of file the field takes. */
  accept: string;
  description: string;
  /** The words in the area that takes the file. */
  drop: string;
  file: File | null;
  label: string;
  onFile: (file: File | null) => void;
}) {
  const t = useTranslations("Exams");
  const id = useId();
  const [dragging, setDragging] = useState(false);

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {file === null ? (
        <div
          className="bg-muted/40 text-muted-foreground hover:bg-muted has-focus-visible:border-ring has-focus-visible:ring-ring/50 data-[dragging=true]:border-primary data-[dragging=true]:bg-muted relative flex h-24 flex-col items-center justify-center gap-2 rounded-lg border px-4 text-center text-sm transition-colors has-focus-visible:ring-3"
          data-dragging={dragging}
        >
          <HugeIcons aria-hidden="true" icon={FileUploadIcon} />
          <span>{drop}</span>
          <input
            accept={accept}
            aria-label={label}
            className="absolute inset-0 opacity-0"
            id={id}
            onChange={(event) => onFile(event.target.files?.item(0) ?? null)}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDrop={() => setDragging(false)}
            type="file"
          />
        </div>
      ) : (
        <div className="flex min-h-24 min-w-0 items-center gap-2 rounded-lg border py-1 pr-1 pl-3 text-sm">
          <HugeIcons aria-hidden="true" icon={FileAttachmentIcon} />
          <span className="min-w-0 flex-1 truncate" dir="auto">
            {file.name}
          </span>
          <Button
            aria-label={t("import-remove")}
            onClick={() => onFile(null)}
            size="icon-sm"
            variant="ghost"
          >
            <HugeIcons aria-hidden="true" icon={Cancel01Icon} />
          </Button>
        </div>
      )}
      <FieldDescription>{description}</FieldDescription>
    </Field>
  );
}
