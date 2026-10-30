import {
  Cancel01Icon,
  FileAttachmentIcon,
  FileUploadIcon,
  GoogleDriveIcon,
} from "@hugeicons/core-free-icons";
import { LIBRARY_ACCEPT } from "@repo/backend/confect/classroom/library/item";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { cn } from "cn";
import { type ReactNode, useId, useState } from "react";
import { useLocale, useTranslations } from "use-intl";

/** The file of a new item: a drop area until a file is chosen, then the file's name with a way to clear it. */
export function LibraryFileField({
  file,
  onFile,
  oversize,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
  oversize: boolean;
}) {
  const t = useTranslations("Classroom");
  const id = useId();
  const [dragging, setDragging] = useState(false);

  return (
    <Field data-invalid={oversize}>
      <FieldLabel htmlFor={id}>{t("library-file")}</FieldLabel>
      {file === null ? (
        <div
          className="relative flex h-24 flex-col items-center justify-center gap-2 rounded-lg border bg-muted/40 px-4 text-center text-muted-foreground text-sm transition-colors hover:bg-muted has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50 data-[dragging=true]:border-primary data-[dragging=true]:bg-muted"
          data-dragging={dragging}
        >
          <HugeIcons aria-hidden="true" icon={FileUploadIcon} />
          <span>{t("library-drop")}</span>
          <input
            accept={LIBRARY_ACCEPT}
            aria-label={t("library-file")}
            className="absolute inset-0 cursor-pointer opacity-0"
            id={id}
            onChange={(event) => onFile(event.target.files?.item(0) ?? null)}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDrop={() => setDragging(false)}
            type="file"
          />
        </div>
      ) : (
        <ChosenFile
          className="min-h-24"
          icon={FileAttachmentIcon}
          name={file.name}
          onClear={() => onFile(null)}
        />
      )}
      <FieldDescription>{t("library-file-limit")}</FieldDescription>
      <FieldError>{oversize ? t("library-file-oversize") : null}</FieldError>
    </Field>
  );
}

/** A chosen file of a new item: its icon and name, with a way to clear it. */
export function ChosenFile({
  className,
  icon,
  name,
  onClear,
}: {
  /** The row's height, when it stands where a taller area stood, so the hint under it stays put. */
  className?: string;
  icon: typeof FileAttachmentIcon;
  name: string;
  onClear: () => void;
}) {
  const t = useTranslations("Classroom");

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border py-1 pr-1 pl-3 text-sm",
        className
      )}
    >
      <HugeIcons aria-hidden="true" icon={icon} />
      <span className="wrap-anywhere min-w-0 flex-1" dir="auto">
        {name}
      </span>
      <Button
        aria-label={t("library-file-clear")}
        onClick={onClear}
        size="icon-sm"
        variant="ghost"
      >
        <HugeIcons aria-hidden="true" icon={Cancel01Icon} />
      </Button>
    </div>
  );
}

/**
 * The Drive file of a new item: a button that opens Google's Picker until a file is picked, then
 * the chosen file, with a way to clear it, which the dialog composes. An account without Drive is told so, with a link to its
 * connections, which opens beside the class so the dialog keeps what was written.
 */
export function LibraryDriveField({
  children,
  chosen,
  missing,
  onChoose,
  pending,
}: {
  /** The chosen file, which the dialog composes once a file is picked. */
  children: ReactNode;
  chosen: boolean;
  missing: boolean;
  onChoose: () => void;
  pending: boolean;
}) {
  const t = useTranslations("Classroom");
  const locale = useLocale();

  return (
    <Field>
      {/* The button's own words name it, so the field's title is not its label. */}
      <FieldTitle>{t("library-drive")}</FieldTitle>
      {chosen ? (
        children
      ) : (
        <Button disabled={pending} onClick={onChoose} variant="outline">
          <HugeIcons aria-hidden="true" icon={GoogleDriveIcon} />
          {t("library-drive-choose")}
        </Button>
      )}
      <FieldDescription>{t("library-file-limit")}</FieldDescription>
      <FieldError>
        {missing ? (
          <>
            {t("library-drive-missing")}{" "}
            <a
              className="font-medium text-foreground underline underline-offset-4"
              href={
                new URL(`/${locale}/user/settings/connectors`, SITE_ORIGIN).href
              }
              rel="noopener"
              target="_blank"
            >
              {t("library-drive-connect")}
            </a>
          </>
        ) : null}
      </FieldError>
    </Field>
  );
}
