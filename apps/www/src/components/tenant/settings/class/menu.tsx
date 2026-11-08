import { useMutation } from "@confect/react";
import {
  Archive02Icon,
  ArchiveRestoreIcon,
  Edit02Icon,
  PencilEdit02Icon,
  UserStar01Icon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { ClassName, ClassSubject } from "@repo/backend/confect/classroom/class";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Schema } from "effect";
import { startTransition, useState } from "react";
import { useTranslations } from "use-intl";
import { useDialogs } from "@/components/shared/dialogs";
import { RowItems } from "@/components/shared/table/menu";
import { LineDialog } from "@/components/tenant/line";
import {
  archiveClassChange,
  changeClassSubject,
  renameClassChange,
  restoreClassChange,
  type SchoolClass,
} from "@/components/tenant/settings/class/changes";
import { ClassTeachersDialog } from "@/components/tenant/settings/class/teachers";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

/** The restore action of an archived classroom. The classroom shows as active at once. */
export function SchoolClassRestore({
  row,
  slug,
}: {
  row: SchoolClass;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const restore = useMutation(classroom.classes.restore).withOptimisticUpdate(
    restoreClassChange
  );

  return (
    <RowItems>
      <DropdownMenuItem
        icon={ArchiveRestoreIcon}
        onClick={() =>
          startTransition(() =>
            runSchoolWrite(schoolCall(() => restore({ classId: row.id, slug })))
          )
        }
      >
        {t("class-restore")}
      </DropdownMenuItem>
    </RowItems>
  );
}

/**
 * An active classroom's row menu: it opens the classroom's subject teachers, renames the classroom in a dialog that
 * saves only a name the classroom does not have yet, or archives it, with an undo in the toast that says so. A
 * classroom the server has not answered yet keeps its menu inert.
 */
export function SchoolClassMenu({
  row,
  slug,
}: {
  row: SchoolClass;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const archive = useMutation(classroom.classes.archive).withOptimisticUpdate(
    archiveClassChange
  );
  const restore = useMutation(classroom.classes.restore).withOptimisticUpdate(
    restoreClassChange
  );
  const rename = useMutation(classroom.classes.rename).withOptimisticUpdate(
    renameClassChange
  );
  const changeSubject = useMutation(
    classroom.classes.changeSubject
  ).withOptimisticUpdate(changeClassSubject);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dialogs = useDialogs<"rename" | "subject" | "teach">();

  return (
    <>
      <RowItems onOpenChange={setIsMenuOpen}>
        <DropdownMenuItem
          icon={UserStar01Icon}
          onClick={() => dialogs.show("teach")}
        >
          {t("class-teachers")}
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={PencilEdit02Icon}
          onClick={() => dialogs.show("rename")}
        >
          {t("class-rename")}
        </DropdownMenuItem>
        {row.subject === undefined ? null : (
          <DropdownMenuItem
            icon={Edit02Icon}
            onClick={() => dialogs.show("subject")}
          >
            {t("class-subject-change")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={Archive02Icon}
          onClick={() =>
            startTransition(() =>
              runSchoolWrite(
                schoolCall(() => archive({ classId: row.id, slug })),
                {
                  onSaved: () =>
                    toast.success(
                      { title: "school-class-archived.title" },
                      {
                        action: {
                          label: "undo",
                          onClick: () =>
                            startTransition(() =>
                              runSchoolWrite(
                                schoolCall(() =>
                                  restore({ classId: row.id, slug })
                                )
                              )
                            ),
                        },
                      }
                    ),
                }
              )
            )
          }
        >
          {t("class-archive")}
        </DropdownMenuItem>
      </RowItems>
      {dialogs.kind === "subject" ? (
        <LineDialog
          description={t("class-subject-change-description")}
          initial={row.subject ?? ""}
          isValid={Schema.is(ClassSubject)}
          key={dialogs.key}
          label={t("class-subject")}
          onSave={(subject) =>
            startTransition(() =>
              runSchoolWrite(
                schoolCall(() =>
                  changeSubject({ classId: row.id, slug, subject })
                )
              )
            )
          }
          open={dialogs.isOpen("subject")}
          placeholder={t("class-subject-placeholder")}
          setOpen={dialogs.setOpen}
          title={t("class-subject-change")}
        />
      ) : null}
      <ClassTeachersDialog
        isRead={isMenuOpen || dialogs.isOpen("teach")}
        open={dialogs.isOpen("teach")}
        row={row}
        setOpen={dialogs.setOpen}
        slug={slug}
      />
      {dialogs.kind === "rename" ? (
        <LineDialog
          action={t("class-rename-save")}
          description={t("class-rename-description")}
          initial={row.name}
          isValid={Schema.is(ClassName)}
          key={dialogs.key}
          label={t("class-name")}
          onSave={(name) =>
            startTransition(() =>
              runSchoolWrite(
                schoolCall(() => rename({ classId: row.id, name, slug }))
              )
            )
          }
          open={dialogs.isOpen("rename")}
          placeholder={t("class-name-placeholder")}
          setOpen={dialogs.setOpen}
          title={t("class-rename")}
        />
      ) : null}
    </>
  );
}
