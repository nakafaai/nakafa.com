import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { PopupHold } from "@repo/design-system/components/ui/hold";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr } from "effect";
import { startTransition, useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { reloadPage } from "@/components/shared/reload";
import { TableEnd } from "@/components/shared/table/pages";
import { LoadFailure } from "@/components/state/failure";
import {
  assignTeacherChange,
  removeTeacherChange,
  type SchoolClass,
} from "@/components/tenant/settings/class/changes";
import {
  type PersonId,
  SchoolTeacherPicker,
} from "@/components/tenant/settings/people";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/settings/class/teachers";

/** How many teachers one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** One subject teacher of a classroom as its teachers list shows them. */
type ClassTeacher = PaginatedQueryItem<typeof classroom.teachers.list>;

/**
 * The dialog of a classroom's subject teachers, which the row menu's Teachers item opens: the picker of a teacher of
 * the classroom's unit that Add teacher assigns, and the teachers the classroom has, each with Remove. The dialog stays open
 * while the admin assigns and removes, and the picker clears once the server accepts a teacher. The list is read
 * from the moment the row menu opens, so it is in when the dialog opens.
 */
export function ClassTeachersDialog({
  isRead,
  open,
  row,
  setOpen,
  slug,
}: {
  /** Whether the list is read: while the row menu or the dialog is open. */
  isRead: boolean;
  open: boolean;
  row: SchoolClass;
  setOpen: (open: boolean) => void;
  slug: TenantSlug;
}) {
  const classId = row.id;
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const assign = useMutation(classroom.teachers.assign).withOptimisticUpdate(
    assignTeacherChange
  );
  const [personId, setPersonId] = useState<PersonId | undefined>(undefined);
  const [isPending, startSaving] = useTransition();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    classroom.teachers.list,
    isSettled && isRead ? { classId, slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const add = () => {
    if (personId === undefined) {
      return;
    }
    startSaving(() =>
      saveSchool(
        () => assign({ classId, personId, slug }),
        SOURCE,
        () => setPersonId(undefined)
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("class-teachers-description")}
      footer={
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("close")}
          </Button>
          <Button
            disabled={personId === undefined || isPending}
            inert={isPending}
            onClick={add}
            type="button"
          >
            {t("class-teacher-add")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("class-teachers")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-teacher`}>
            {t("class-teacher")}
          </FieldLabel>
          <SchoolTeacherPicker
            cohortId={row.cohortId}
            id={`${id}-teacher`}
            onChoose={setPersonId}
            personId={personId}
          />
        </Field>
        {PaginatedQueryResult.isFailure(pagination) ? (
          <LoadFailure onRetry={reloadPage} />
        ) : null}
        {pagination._tag === "LoadingFirstPage" ? (
          <PopupHold />
        ) : (
          <ClassTeacherList
            classId={classId}
            slug={slug}
            teachers={pagination.results}
          />
        )}
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <TableEnd onLoad={() => pagination.loadMore(PAGE_SIZE)} />
        ) : null}
      </FieldGroup>
    </ResponsiveDialog>
  );
}

/** The teachers a classroom has, each with Remove, or the sentence of a classroom that has none. */
function ClassTeacherList({
  classId,
  slug,
  teachers,
}: {
  classId: SchoolClass["id"];
  slug: TenantSlug;
  teachers: readonly ClassTeacher[];
}) {
  const t = useTranslations("SchoolSettings");
  const remove = useMutation(classroom.teachers.remove).withOptimisticUpdate(
    removeTeacherChange
  );

  if (Arr.isReadonlyArrayEmpty(teachers)) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("class-teachers-empty")}
      </p>
    );
  }
  return (
    <ItemGroup aria-label={t("class-teachers")}>
      {Arr.map(teachers, (teacher) => (
        <Item key={teacher.id} render={<li />} size="sm" variant="outline">
          <ItemContent>
            <ItemTitle>{teacher.name}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Button
              aria-label={t("class-teacher-remove-label", {
                name: teacher.name,
              })}
              onClick={() =>
                startTransition(() =>
                  saveSchool(
                    () => remove({ classId, personId: teacher.id, slug }),
                    SOURCE
                  )
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {t("class-teacher-remove")}
            </Button>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}
