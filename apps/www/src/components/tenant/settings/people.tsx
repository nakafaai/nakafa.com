import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  usePaginatedQuery,
} from "@confect/react";
import { ArrowDown01Icon, UserIcon } from "@hugeicons/core-free-icons";
import { useDebouncedValue } from "@mantine/hooks";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Picker,
  PickerContent,
  PickerItem,
  PickerTrigger,
} from "@repo/design-system/components/ui/picker";
import { selectTriggerVariants } from "@repo/design-system/components/ui/select";
import { Array as Arr, Option } from "effect";
import { createContext, use, useState } from "react";
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

/**
 * What a picker's list does at its end, which loads the next page while one is left, and whether its first page is
 * still being read.
 */
function pagesOf<Item, E>(
  pagination: PaginatedQueryResult.PaginatedQueryResult<Item, E>
) {
  return {
    onEnd: PaginatedQueryResult.isCanLoadMore(pagination)
      ? () => pagination.loadMore(PICKER_SIZE)
      : undefined,
    waiting: PaginatedQueryResult.isLoadingFirstPage(pagination),
  };
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
  const pages = pagesOf(pagination);

  return (
    <>
      {PaginatedQueryResult.isFailure(pagination) ? (
        <LoadFailure onRetry={reloadPage} />
      ) : null}
      <PersonSelect
        onEnd={pages.onEnd}
        people={pagination.results}
        setTyped={setTyped}
        typed={typed}
        waiting={pages.waiting}
      />
    </>
  );
}

/**
 * Renders the picker of the students of the school: the active members who hold a student
 * grant. For a cohort it offers only the students of the cohort's unit who hold no placement in
 * its period, so a student placed elsewhere is moved from that cohort instead. A student is chosen
 * by ID, and the list loads more students as its end comes into view.
 */
export function SchoolStudentPicker({
  cohortId,
  ...field
}: PickerField & {
  /** The live cohort the student joins, which narrows the list to who it may place. */
  cohortId?: CohortDetail["id"] | undefined;
}) {
  return (
    <PickerFieldContext value={field}>
      <PickerCohortContext value={cohortId ?? null}>
        <ReadBoundary>
          <SchoolStudentSelect />
        </ReadBoundary>
      </PickerCohortContext>
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
  const pages = pagesOf(pagination);

  return (
    <>
      {PaginatedQueryResult.isFailure(pagination) ? (
        <LoadFailure onRetry={reloadPage} />
      ) : null}
      <PersonSelect
        onEnd={pages.onEnd}
        people={pagination.results}
        setTyped={setTyped}
        source="teacher-picker-empty"
        typed={typed}
        waiting={pages.waiting}
      />
    </>
  );
}

/** The picker's list of students, read a page at a time. */
function SchoolStudentSelect() {
  const { slug } = useTenant();
  const cohortId = use(PickerCohortContext);
  const { search, setTyped, typed } = usePickerSearch();
  const school = usePaginatedQuery(
    tenancy.people.students,
    cohortId === null ? { slug, ...search } : "skip",
    { initialNumItems: PICKER_SIZE }
  );
  const cohort = usePaginatedQuery(
    tenancy.people.unplaced,
    cohortId === null ? "skip" : { cohortId, slug, ...search },
    { initialNumItems: PICKER_SIZE }
  );
  const pagination = cohortId === null ? school : cohort;
  const pages = pagesOf(pagination);

  return (
    <>
      {PaginatedQueryResult.isFailure(pagination) ? (
        <LoadFailure onRetry={reloadPage} />
      ) : null}
      <PersonSelect
        onEnd={pages.onEnd}
        people={pagination.results}
        setTyped={setTyped}
        source={
          cohortId === null ? "student-picker-empty" : "cohort-picker-empty"
        }
        typed={typed}
        waiting={pages.waiting}
      />
    </>
  );
}

/**
 * A picker's button, under its field's label, and the list it opens with the box that finds a person: one row per
 * person, named by the person's name, which loads the next page as its end comes into view. A person listed twice shows
 * once. The server reads the box, so it reaches a person of any page of a school of thousands, and while a new search
 * is read the list keeps the people it showed. A list with nobody in it says where its people come from (`source`), or
 * that the box found nobody.
 */
function PersonSelect({
  onEnd,
  people,
  setTyped,
  source,
  typed,
  waiting,
}: {
  onEnd: (() => void) | undefined;
  people: readonly PersonItem[];
  setTyped: (typed: string) => void;
  source?:
    | "cohort-picker-empty"
    | "student-picker-empty"
    | "teacher-picker-empty";
  typed: string;
  waiting: boolean;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const { id, onChoose, personId } = usePickerField();
  // A later search can leave the chosen person out of the list, and the button still names them.
  const [chosen, setChosen] = useState<Option.Option<PersonItem>>(Option.none);
  const items = Arr.dedupeWith(
    useKeptPeople(people, waiting),
    (first, second) => first.id === second.id
  );
  const named = Arr.findFirst(
    Option.match(chosen, {
      onNone: () => items,
      onSome: (person) => Arr.prepend(items, person),
    }),
    (person) => person.id === personId
  );
  const origin = source === undefined ? undefined : t(source);

  return (
    <Picker search={{ onTextChange: setTyped, text: typed }}>
      <PickerTrigger
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
      </PickerTrigger>
      <PickerContent
        empty={
          typed === "" && origin !== undefined
            ? origin
            : t("person-search-empty")
        }
        items={items}
        itemToStringValue={(person) => person.name}
        label={common("menu-person")}
        maxLength={SEARCH_LIMIT}
        onEnd={onEnd}
        placeholder={t("roles-search")}
        waiting={waiting}
      >
        {(person) => (
          <PersonOption
            key={person.id}
            onChoose={() => {
              setChosen(Option.some(person));
              onChoose(person.id);
            }}
            person={person}
            selected={person.id === personId}
          />
        )}
      </PickerContent>
    </Picker>
  );
}

/** One person of a picker, named by the person's name. */
function PersonOption({
  onChoose,
  person,
  selected,
}: {
  onChoose: () => void;
  person: PersonItem;
  selected: boolean;
}) {
  return (
    <PickerItem
      icon={UserIcon}
      onClick={onChoose}
      selected={selected}
      value={person}
    >
      <span className="truncate" dir="auto">
        {person.name}
      </span>
    </PickerItem>
  );
}

/**
 * The people a picker lists: the read's, or the last ones it listed while a new search reads its first page, so the
 * list never empties under the learner's typing.
 */
function useKeptPeople(people: readonly PersonItem[], waiting: boolean) {
  const [kept, setKept] = useState(people);
  if (waiting) {
    return kept;
  }
  if (!samePeople(people, kept)) {
    setKept(people);
  }
  return people;
}

/** Whether two lists name the same people in the same order. */
function samePeople(left: readonly PersonItem[], right: readonly PersonItem[]) {
  return Arr.makeEquivalence(
    (one: PersonItem, other: PersonItem) => one.id === other.id
  )(left, right);
}
