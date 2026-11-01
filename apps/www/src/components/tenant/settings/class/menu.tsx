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
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Schema } from "effect";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
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
  const id = useId();
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
  const [isTeaching, setIsTeaching] = useState(false);
  const [subjecting, setSubjecting] = useState(0);
  const [isSubjecting, setIsSubjecting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(row.name);
  const next = name.trim();
  const canSave = next !== row.name && Schema.is(ClassName)(next);

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
          <DropdownMenuItem onClick={() => setIsTeaching(true)}>
            <HugeIcons icon={UserStar01Icon} />
            {t("class-teachers")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setName(row.name);
              setIsRenaming(true);
            }}
          >
            <HugeIcons icon={PencilEdit02Icon} />
            {t("class-rename")}
          </DropdownMenuItem>
          {row.subject === undefined ? null : (
            <DropdownMenuItem
              onClick={() => {
                setSubjecting((count) => count + 1);
                setIsSubjecting(true);
              }}
            >
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
      {subjecting === 0 ? null : (
        <LineDialog
          description={t("class-subject-change-description")}
          initial={row.subject ?? ""}
          isValid={Schema.is(ClassSubject)}
          key={subjecting}
          label={t("class-subject")}
          onSave={(subject) =>
            startTransition(() =>
              saveSchool(
                () => changeSubject({ classId: row.id, slug, subject }),
                SOURCE
              )
            )
          }
          open={isSubjecting}
          placeholder={t("class-subject-placeholder")}
          setOpen={setIsSubjecting}
          title={t("class-subject-change")}
        />
      )}
      <ClassTeachersDialog
        isRead={isMenuOpen || isTeaching}
        open={isTeaching}
        row={row}
        setOpen={setIsTeaching}
        slug={slug}
      />
      <ResponsiveDialog
        description={t("class-rename-description")}
        footer={
          <>
            <Button
              onClick={() => setIsRenaming(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button
              disabled={!canSave}
              onClick={() => {
                setIsRenaming(false);
                startTransition(() =>
                  saveSchool(
                    () => rename({ classId: row.id, name: next, slug }),
                    SOURCE
                  )
                );
              }}
              type="button"
            >
              {t("class-rename-save")}
            </Button>
          </>
        }
        open={isRenaming}
        setOpen={setIsRenaming}
        title={t("class-rename")}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>{t("class-name")}</FieldLabel>
            <Input
              id={`${id}-name`}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("class-name-placeholder")}
              value={name}
            />
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </div>
  );
}
