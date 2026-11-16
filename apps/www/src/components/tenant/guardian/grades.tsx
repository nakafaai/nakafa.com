import type { GenericId, Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import { Comment01Icon, Copy01Icon } from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { reloadPage } from "@/components/shared/reload";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { RowItems } from "@/components/shared/table/menu";
import { EmptyState } from "@/components/state/empty";
import { LoadFailure } from "@/components/state/failure";
import { EmptyNina } from "@/components/state/nina";
import { useTenant } from "@/components/tenant/context";

/** One released grade of a child. */
type ChildGrade = Ref.Returns<typeof guardians.family.grades>[number];

/** One class's comment on a child, which its grade row's menu opens. */
type ChildNarrative = Ref.Returns<typeof guardians.family.narratives>[number];

/** The columns of a child's grades. */
const gradeColumns = tableColumns<ChildGrade>();

/**
 * The released grades of a child of a verified link, one row a class, as the child pane's Grades view: each class's
 * comment behind its row's menu, and the empty state while none is released.
 */
export function GuardianGrades({
  linkId,
}: {
  linkId: GenericId.GenericId<"guardianLinks">;
}) {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
  const grades = useQuery(guardians.family.grades, { linkId, slug });
  const narratives = useQuery(guardians.family.narratives, { linkId, slug });

  if (QueryResult.isFailure(grades)) {
    return <LoadFailure onRetry={reloadPage} />;
  }
  return (
    <DataTable
      columns={[
        gradeColumns.text((grade) => grade.className, {
          cell: (info) => <span dir="auto">{info.getValue()}</span>,
          header: t("grade-class"),
          id: "class",
        }),
        gradeColumns.number((grade) => grade.value, {
          header: t("grade-value"),
          id: "value",
        }),
        gradeColumns.text((grade) => grade.band ?? t(`kktp-${grade.kktp}`), {
          header: t("grade-note"),
          id: "note",
        }),
        gradeColumns.menu((info) => (
          <GradeMenu
            grade={info.row.original}
            narrative={Arr.findFirst(
              QueryResult.isSuccess(narratives) ? narratives.value : [],
              (narrative) => narrative.className === info.row.original.className
            )}
          />
        )),
      ]}
      data={QueryResult.isSuccess(grades) ? grades.value : []}
      empty={
        <EmptyState
          description={t("grades-empty-description")}
          scene={<EmptyNina act="counting" />}
          title={t("grades-empty")}
        />
      }
      loading={!QueryResult.isSuccess(grades)}
      plain
      rowId={(grade) => grade.id}
    />
  );
}

/** A grade row's menu: the class's comment, when its teacher wrote one, and a copy of the class's name. */
function GradeMenu({
  grade,
  narrative,
}: {
  grade: ChildGrade;
  narrative: Option.Option<ChildNarrative>;
}) {
  const t = useTranslations("SchoolGuardians");
  const common = useTranslations("Common");
  const clipboard = useClipboard();
  const [openings, setOpenings] = useState(0);

  return (
    <>
      <RowItems>
        {Option.isSome(narrative) ? (
          <DropdownMenuItem
            icon={Comment01Icon}
            onClick={() => setOpenings((count) => count + 1)}
          >
            {t("grade-comment")}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          icon={Copy01Icon}
          onClick={() => clipboard.copy(grade.className)}
        >
          {common("copy")}
        </DropdownMenuItem>
      </RowItems>
      {openings === 0 || Option.isNone(narrative) ? null : (
        <CommentDialog key={openings} narrative={narrative.value} />
      )}
    </>
  );
}

/** One class's comment on the child, as its teacher wrote it. */
function CommentDialog({ narrative }: { narrative: ChildNarrative }) {
  const t = useTranslations("SchoolGuardians");
  const [open, setOpen] = useState(true);

  return (
    <ResponsiveDialog
      description={t("grade-comment")}
      open={open}
      setOpen={setOpen}
      title={narrative.className}
    >
      <p className="text-sm wrap-anywhere whitespace-pre-wrap" dir="auto">
        {narrative.text}
      </p>
    </ResponsiveDialog>
  );
}
