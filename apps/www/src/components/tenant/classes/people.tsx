import { QueryResult, useQuery } from "@confect/react";
import { StudentIcon, TeacherIcon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type {
  ClassPerson,
  ClassPersonKind,
} from "@repo/backend/confect/classroom/people.spec";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { ClassHeader } from "@/components/tenant/classes/header";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";

/** The columns of the people table. */
const personColumns = tableColumns<typeof ClassPerson.Type>();

/** The look of each kind of Person in a class. */
const KIND_LOOKS = {
  student: { icon: StudentIcon, tone: "neutral" },
  teacher: { icon: TeacherIcon, tone: "info" },
} as const satisfies Record<typeof ClassPersonKind.Type, StatusLook>;

/**
 * Who teaches a class and who learns in it: the class header with the search over the names, and
 * the people in the page's one table card, its teachers first. A class with no one shows the empty
 * state without a search, a failed read its sentence and Try again, and a viewer who lost the
 * school's access is sent to the refused page.
 */
export function PeopleList() {
  return (
    <TableFiltersProvider>
      <PeopleBody />
    </TableFiltersProvider>
  );
}

/** The header and the table of the class's people. */
function PeopleBody() {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const columns = usePersonColumns();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const read = useQuery(
    classroom.people.list,
    isSettled ? { classId, slug } : "skip"
  );
  if (QueryResult.isFailure(read) && isLostAccess(read.error)) {
    throw read.error;
  }
  const empty =
    QueryResult.isSuccess(read) && Arr.isReadonlyArrayEmpty(read.value);

  return (
    <>
      <ClassHeader>
        {empty ? null : <TableSearch placeholder={t("people-search")} />}
      </ClassHeader>
      <TablePageBody>
        {empty ? (
          <TableEmpty
            act="typing"
            description={t("people-empty-description")}
            title={t("people-empty")}
          />
        ) : null}
        {QueryResult.isFailure(read) ? (
          <DataFailure onRetry={reloadPage} />
        ) : null}
        {QueryResult.isSuccess(read) && !empty ? (
          <DataTable
            columns={columns}
            data={read.value}
            rowId={(person) => person.id}
            search="name"
          />
        ) : null}
      </TablePageBody>
    </>
  );
}

/** The columns of the people table: each person's name, and whether they teach or learn here. */
function usePersonColumns() {
  const t = useTranslations("Classroom");

  return [
    personColumns.text((person) => person.name, {
      cell: (info) => (
        <span className="font-medium" dir="auto">
          {info.getValue()}
        </span>
      ),
      header: t("people-name"),
      id: "name",
    }),
    personColumns.values((person) => person.kind, {
      cell: (info) => (
        <TableStatus
          {...KIND_LOOKS[info.getValue()]}
          label={t(`people-${info.getValue()}`)}
        />
      ),
      header: t("people-role"),
      id: "kind",
      options: Arr.map(["teacher", "student"] as const, (kind) => ({
        icon: KIND_LOOKS[kind].icon,
        label: t(`people-${kind}`),
        value: kind,
      })),
    }),
  ];
}
