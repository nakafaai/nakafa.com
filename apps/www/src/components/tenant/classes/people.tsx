import { QueryResult, useQuery } from "@confect/react";
import {
  Copy01Icon,
  Mail01Icon,
  StudentIcon,
  TeacherIcon,
  Tick01Icon,
  UserAdd01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type {
  ClassPerson,
  ClassPersonKind,
} from "@repo/backend/confect/classroom/people.spec";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { reloadPage } from "@/components/shared/reload";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { RowMenu } from "@/components/shared/table/menu";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
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

/** The look of each Person in the class's Status column: one who holds an account here, and one who has yet to join. */
const JOIN_LOOKS = {
  joined: { icon: UserCircleIcon, tone: "success" },
  waiting: { icon: UserAdd01Icon, tone: "warning" },
} as const satisfies Record<string, StatusLook>;

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
          <LoadFailure onRetry={reloadPage} />
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

/**
 * The columns of the people table: each person's name, their address for a viewer who keeps the class, whether they
 * teach or learn here, whether they have joined, and what the row can do.
 */
function usePersonColumns() {
  const t = useTranslations("Classroom");
  const { can } = useClassScope();

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
    ...(Arr.contains(can, "task.manage")
      ? [
          personColumns.text((person) => person.email ?? "", {
            cell: (info) => (
              <span className="text-muted-foreground">{info.getValue()}</span>
            ),
            header: t("people-email"),
            id: "email",
          }),
        ]
      : []),
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
    personColumns.values((person) => (person.joined ? "joined" : "waiting"), {
      cell: (info) => (
        <TableStatus
          {...JOIN_LOOKS[info.getValue()]}
          label={t(`people-${info.getValue()}`)}
        />
      ),
      header: t("people-status"),
      id: "joined",
      options: Arr.map(["joined", "waiting"] as const, (joined) => ({
        icon: JOIN_LOOKS[joined].icon,
        label: t(`people-${joined}`),
        value: joined,
      })),
    }),
    personColumns.menu((info) => <PersonMenu person={info.row.original} />),
  ];
}

/** What a row of the people table can do: copy the person's name, and their address for a viewer who reads it. */
function PersonMenu({ person }: { person: typeof ClassPerson.Type }) {
  const t = useTranslations("Classroom");

  return (
    <RowMenu>
      <DropdownMenuGroup>
        <CopyItem
          icon={Copy01Icon}
          label={t("people-copy-name")}
          value={person.name}
        />
        {person.email === null ? null : (
          <CopyItem
            icon={Mail01Icon}
            label={t("people-copy-email")}
            value={person.email}
          />
        )}
      </DropdownMenuGroup>
    </RowMenu>
  );
}

/** A menu item that copies `value`, which stays open with a tick for a moment so the press shows. */
function CopyItem({
  icon,
  label,
  value,
}: {
  icon: ComponentProps<typeof HugeIcons>["icon"];
  label: string;
  value: string;
}) {
  const clipboard = useClipboard({ timeout: 1500 });

  return (
    <DropdownMenuItem
      closeOnClick={false}
      onClick={() => clipboard.copy(value)}
    >
      <HugeIcons icon={clipboard.copied ? Tick01Icon : icon} />
      {label}
    </DropdownMenuItem>
  );
}
