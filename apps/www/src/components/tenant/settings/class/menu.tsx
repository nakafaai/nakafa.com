import { useMutation } from "@confect/react";
import {
  Archive02Icon,
  Edit02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  UserStar01Icon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { ClassName, ClassSubject } from "@repo/backend/confect/classroom/class";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Schema } from "effect";
import { startTransition, useState } from "react";
import { useTranslations } from "use-intl";
import { useDialogs } from "@/components/shared/dialogs";
import { LineDialog } from "@/components/tenant/line";
import {
  archiveClassChange,
  changeClassSubject,
  renameClassChange,
  restoreClassChange,
  type SchoolClass,
} from "@/components/tenant/settings/class/changes";
import { ClassTeachersDialog } from "@/components/tenant/settings/class/teachers";
import { saveSchool } from "@/components/tenant/settings/save";
import { isDraft } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/class/menu";

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
    <div className="flex justify-end">
      <Button
        onClick={() =>
          startTransition(() =>
            saveSchool(() => restore({ classId: row.id, slug }), SOURCE)
          )
        }
        size="sm"
        type="button"
        variant="outline"
      >
        {t("class-restore")}
      </Button>
    </div>
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
  const common = useTranslations("Common");
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
    <div className="flex justify-end">
      <DropdownMenu onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              inert={isDraft(row.id)}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => dialogs.show("teach")}>
            <HugeIcons icon={UserStar01Icon} />
            {t("class-teachers")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => dialogs.show("rename")}>
            <HugeIcons icon={PencilEdit02Icon} />
            {t("class-rename")}
          </DropdownMenuItem>
          {row.subject === undefined ? null : (
            <DropdownMenuItem onClick={() => dialogs.show("subject")}>
              <HugeIcons icon={Edit02Icon} />
              {t("class-subject-change")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() =>
              startTransition(() =>
                saveSchool(
                  () => archive({ classId: row.id, slug }),
                  SOURCE,
                  () =>
                    toast.success(
                      { title: "school-class-archived.title" },
                      {
                        action: {
                          label: "undo",
                          onClick: () =>
                            startTransition(() =>
                              saveSchool(
                                () => restore({ classId: row.id, slug }),
                                SOURCE
                              )
                            ),
                        },
                      }
                    )
                )
              )
            }
          >
            <HugeIcons icon={Archive02Icon} />
            {t("class-archive")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs.kind === "subject" ? (
        <LineDialog
          description={t("class-subject-change-description")}
          initial={row.subject ?? ""}
          isValid={Schema.is(ClassSubject)}
          key={dialogs.key}
          label={t("class-subject")}
          onSave={(subject) =>
            startTransition(() =>
              saveSchool(
                () => changeSubject({ classId: row.id, slug, subject }),
                SOURCE
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
              saveSchool(() => rename({ classId: row.id, name, slug }), SOURCE)
            )
          }
          open={dialogs.isOpen("rename")}
          placeholder={t("class-name-placeholder")}
          setOpen={dialogs.setOpen}
          title={t("class-rename")}
        />
      ) : null}
    </div>
  );
}
