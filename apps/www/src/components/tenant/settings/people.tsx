import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  usePaginatedQuery,
} from "@confect/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { useDebouncedValue } from "@mantine/hooks";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/design-system/components/ui/command";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import {
  SelectEmpty,
  selectTriggerVariants,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { reloadPage } from "@/components/shared/reload";
import { LoadFailure } from "@/components/state/failure";
import { useTenant } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import type { CohortDetail } from "@/components/tenant/settings/state";

/** How many people one page of the picker loads, and each page after it. */
const PICKER_SIZE = 100;

/** How long the typing in a picker's box pauses before the server reads it, and the longest name a person may have. */
const SEARCH_DELAY_MILLISECONDS = 300;
const SEARCH_LIMIT = 120;

/** The ID of one Person of the school. */
export type PersonId = PaginatedQueryItem<typeof tenancy.people.list>["id"];

/** One Person as the picker lists it: its ID, which a choice names, and its name. */
type PersonItem = Pick<
  PaginatedQueryItem<typeof tenancy.people.list>,
  "id" | "name"
>;

/** The field a picker fills: the ID of its trigger, the chosen person, and what a choice does. */
interface PickerField {
  /** The ID of the trigger, which the label of the field names. */
  id: string;
  onChoose: (personId: PersonId) => void;
  personId: PersonId | undefined;
}

/**
 * What a picker's box holds, and the search its list asks the server for once the typing pauses, as the arguments of
 * the list's read.
 */
function usePickerSearch() {
  const [typed, setTyped] = useState("");
  const [search] = useDebouncedValue(typed.trim(), SEARCH_DELAY_MILLISECONDS);
  return { search: search === "" ? {} : { search }, setTyped, typed };
}

/** The field of the picker that renders the select, which its list reads. */
const PickerFieldContext = createContext<PickerField | null>(null);

/** The cohort a teacher picker reads the teachers of. */
const PickerCohortContext = createContext<CohortDetail["id"] | null>(null);

/** Reads the field of the picker. It throws outside a picker, which always provides it. */
function usePickerField() {
  const field = use(PickerFieldContext);
  if (field === null) {
    throw new Error("usePickerField must be used within a school picker");
  }
  return field;
}

/**
 * Renders the picker of an active person of the school. The list loads more people
 * as its end comes into view. A person is chosen by ID, so a choice the list does
 * not hold never reaches a function.
 */
export function SchoolPersonPicker(field: PickerField) {
  return (
    <PickerFieldContext value={field}>
      <ReadBoundary>
        <SchoolPersonSelect />
      </ReadBoundary>
    </PickerFieldContext>
  );
}

/** The picker's list of active people, read a page at a time. */
function SchoolPersonSelect() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const { search, setTyped, typed } = usePickerSearch();
  const pagination = usePaginatedQuery(
    tenancy.people.list,
    isSettled ? { slug, status: "active", ...search } : "skip",
    { initialNumItems: PICKER_SIZE }
  );

  return (
    <>
      {PaginatedQueryResult.isFailure(pagination) ? (
        <LoadFailure onRetry={reloadPage} />
      ) : null}
      <PersonSelect
        people={pagination.results}
        setTyped={setTyped}
        typed={typed}
      >
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PICKER_SIZE)} />
        ) : null}
        {PaginatedQueryResult.isExhausted(pagination) &&
        Arr.isReadonlyArrayEmpty(pagination.results) ? (
          <NoPerson typed={typed} />
        ) : null}
      </PersonSelect>
    </>
  );
}

/**
 * Renders the picker of the students of the school: the active members who hold a student
 * grant. A student is chosen by ID, and the list loads more students as its end comes into view.
 */
export function SchoolStudentPicker(field: PickerField) {
  return (
    <PickerFieldContext value={field}>
      <ReadBoundary>
        <SchoolStudentSelect />
      </ReadBoundary>
    </PickerFieldContext>
  );
}

/**
 * Renders the picker of the teachers of a cohort's unit, the only people its homeroom and its
 * classes accept. A teacher is chosen by ID, and the list loads more as its end comes into view.
 */
export function SchoolTeacherPicker({
  cohortId,
  ...field
}: PickerField & { cohortId: CohortDetail["id"] }) {
  return (
    <PickerFieldContext value={field}>
      <PickerCohortContext value={cohortId}>
        <ReadBoundary>
          <SchoolTeacherSelect />
        </ReadBoundary>
      </PickerCohortContext>
    </PickerFieldContext>
  );
}

/** The picker's list of teachers, read a page at a time. */
function SchoolTeacherSelect() {
  const { slug } = useTenant();
  const cohortId = use(PickerCohortContext);
  if (cohortId === null) {
    throw new Error("SchoolTeacherSelect must be used within a teacher picker");
  }
  const { search, setTyped, typed } = usePickerSearch();
  const pagination = usePaginatedQuery(
    tenancy.people.teachers,
    { cohortId, slug, ...search },
    { initialNumItems: PICKER_SIZE }
  );

  return (
    <>
      {PaginatedQueryResult.isFailure(pagination) ? (
        <LoadFailure onRetry={reloadPage} />
      ) : null}
      <PersonSelect
        people={pagination.results}
        setTyped={setTyped}
        typed={typed}
      >
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PICKER_SIZE)} />
        ) : null}
        {PaginatedQueryResult.isExhausted(pagination) &&
        !Arr.isReadonlyArrayNonEmpty(pagination.results) ? (
          <NoPerson empty="teacher-picker-empty" typed={typed} />
        ) : null}
      </PersonSelect>
    </>
  );
}

/** What a picker says with nobody to choose: that its box found nobody, or where its people come from. */
function NoPerson({
  empty,
  typed,
}: {
  empty?: "student-picker-empty" | "teacher-picker-empty";
  typed: string;
}) {
  const t = useTranslations("SchoolSettings");
  const tTable = useTranslations("DataTable");

  return (
    <SelectEmpty>
      {typed === "" && empty !== undefined ? t(empty) : tTable("no-results")}
    </SelectEmpty>
  );
}

/** The picker's list of students, read a page at a time. */
function SchoolStudentSelect() {
  const { slug } = useTenant();
  const { search, setTyped, typed } = usePickerSearch();
  const pagination = usePaginatedQuery(
    tenancy.people.students,
    { slug, ...search },
    { initialNumItems: PICKER_SIZE }
  );

  return (
    <>
      {PaginatedQueryResult.isFailure(pagination) ? (
        <LoadFailure onRetry={reloadPage} />
      ) : null}
      <PersonSelect
        people={pagination.results}
        setTyped={setTyped}
        typed={typed}
      >
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PICKER_SIZE)} />
        ) : null}
        {PaginatedQueryResult.isExhausted(pagination) &&
        !Arr.isReadonlyArrayNonEmpty(pagination.results) ? (
          <NoPerson empty="student-picker-empty" typed={typed} />
        ) : null}
      </PersonSelect>
    </>
  );
}

/**
 * A picker's button, under its field's label, with the box that finds a person in the popup under it: one row per
 * person, named by the person's name, and what the caller composes after the rows, the end that loads the next page or
 * the words for a list with nobody in it. A person listed twice shows once. The server reads the box, so it reaches a
 * person of any page of a school of thousands.
 */
function PersonSelect({
  children,
  people,
  setTyped,
  typed,
}: {
  children: ReactNode;
  people: readonly PersonItem[];
  setTyped: (typed: string) => void;
  typed: string;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const { id, onChoose, personId } = usePickerField();
  const [open, setOpen] = useState(false);
  // A later search can leave the chosen person out of the list, and the button still names them.
  const [chosen, setChosen] = useState<Option.Option<PersonItem>>(Option.none);
  const items = Arr.dedupeWith(
    people,
    (first, second) => first.id === second.id
  );
  const named = Arr.findFirst(
    Option.match(chosen, {
      onNone: () => items,
      onSome: (person) => Arr.prepend(items, person),
    }),
    (person) => person.id === personId
  );

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        data-placeholder={Option.isNone(named) ? "" : undefined}
        id={id}
        render={
          <button
            className={selectTriggerVariants({ width: "full" })}
            data-size="default"
            type="button"
          />
        }
        role="combobox"
      >
        <span className="min-w-0 truncate" dir="auto">
          {Option.match(named, {
            onNone: () => t("person-placeholder"),
            onSome: (person) => person.name,
          })}
        </span>
        <HugeIcons
          className="size-4 text-inherit opacity-80"
          icon={ArrowDown01Icon}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) p-0">
        <Command
          filter={null}
          items={items}
          itemToStringValue={(person: PersonItem) => person.name}
          onValueChange={setTyped}
          value={typed}
        >
          <CommandInput
            autoFocus
            clearLabel={common("clear-search")}
            maxLength={SEARCH_LIMIT}
            placeholder={t("person-search")}
          />
          <div className="max-h-64 overflow-y-auto border-t">
            <CommandList scrollArea={false}>
              {(person: PersonItem) => (
                <CommandItem
                  key={person.id}
                  onClick={() => {
                    setChosen(Option.some(person));
                    onChoose(person.id);
                    setTyped("");
                    setOpen(false);
                  }}
                  value={person}
                >
                  <span className="truncate" dir="auto">
                    {person.name}
                  </span>
                </CommandItem>
              )}
            </CommandList>
            {children}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
