import type { Ref } from "@confect/core";
import type {
  OptimisticLocalStore,
  OptimisticUpdate,
  PaginatedQueryItem,
} from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import {
  classNameKey,
  classNameOf,
  classSlugOf,
  classSubjectKey,
} from "@repo/backend/confect/classroom/class";
import { Array as Arr, Option, Order, Schema } from "effect";
import {
  draftText,
  isFirstPage,
  withoutItem,
} from "@/components/tenant/settings/state";

/** One classroom of a period as the classrooms table shows it. */
export type SchoolClass = PaginatedQueryItem<typeof classroom.classes.list>;

/** One subject teacher of a classroom as its teachers list shows them. */
type ClassTeacher = PaginatedQueryItem<typeof classroom.teachers.list>;

/**
 * The optimistic changes of the classrooms of a period and of their subject teachers. Each one shows a mutation's
 * result in every loaded page that it touches, and Confect undoes it when the server refuses the change.
 */

/** The classrooms of one page in the order the list shows them: by subject, then by name, each without case. */
const bySubjectAndName = Order.combine(
  Order.mapInput(Order.String, (row: SchoolClass) =>
    classSubjectKey(row.subject)
  ),
  Order.mapInput(Order.String, (row: SchoolClass) => classNameKey(row.name))
);

/** Changes the page of every loaded list of classrooms that the match accepts. */
function changeClassLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  matches: (args: Ref.Args<typeof classroom.classes.list>) => boolean,
  change: (page: readonly SchoolClass[]) => SchoolClass[]
) {
  for (const query of localStore.getAllQueries(classroom.classes.list)) {
    if (Option.isSome(query.value) && matches(query.args)) {
      localStore.setQuery(
        classroom.classes.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
      );
    }
  }
}

/** Changes one classroom wherever a loaded page holds it, and keeps every other classroom as it is. */
function changeClass(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  classId: SchoolClass["id"],
  change: (row: SchoolClass) => SchoolClass
) {
  changeClassLists(
    localStore,
    () => true,
    (page) => Arr.map(page, (row) => (row.id === classId ? change(row) : row))
  );
}

/**
 * Lists a new classroom at once, as active, on the first page of its period in the list's order, named for its
 * subject and its cohort as the server names it. The page knows the cohort's name and period only from a loaded
 * list of cohorts, which the add dialog reads, so with none loaded the classroom waits for the server. Its ID is a
 * draft until the server answers, so its actions wait.
 */
export const createClassChange: OptimisticUpdate<
  typeof classroom.classes.create
> = (localStore, { cohortId, subject }) => {
  const placed = Arr.findFirst(
    localStore.getAllQueries(tenancy.cohorts.list),
    (query) =>
      Option.flatMap(query.value, (cohorts) =>
        Option.map(
          Arr.findFirst(cohorts, (cohort) => cohort.id === cohortId),
          (cohort) => ({ cohort, periodId: query.args.periodId })
        )
      )
  );
  if (Option.isNone(placed)) {
    return;
  }
  const { cohort, periodId } = placed.value;
  const name = classNameOf(cohort.name, subject);
  const draft: SchoolClass = {
    cohortId,
    id: Schema.decodeUnknownSync(Id("classes"))(draftText()),
    name,
    periodId,
    slug: classSlugOf(name),
    status: "active",
    ...(subject === undefined ? {} : { subject }),
  };
  changeClassLists(
    localStore,
    (args) => args.periodId === periodId && isFirstPage(args),
    (page) => Arr.sort(Arr.prepend(page, draft), bySubjectAndName)
  );
};

/** Shows a classroom under its new name at once. */
export const renameClassChange: OptimisticUpdate<
  typeof classroom.classes.rename
> = (localStore, { classId, name }) => {
  changeClass(localStore, classId, (row) => ({ ...row, name }));
};

/** Shows a classroom's new subject at once. The server settles whether its name follows. */
export const changeClassSubject: OptimisticUpdate<
  typeof classroom.classes.changeSubject
> = (localStore, { classId, subject }) => {
  changeClass(localStore, classId, (row) => ({ ...row, subject }));
};

/** Shows a classroom as archived at once. */
export const archiveClassChange: OptimisticUpdate<
  typeof classroom.classes.archive
> = (localStore, { classId }) => {
  changeClass(localStore, classId, (row) => ({ ...row, status: "archived" }));
};

/** Shows a classroom as active again at once. */
export const restoreClassChange: OptimisticUpdate<
  typeof classroom.classes.restore
> = (localStore, { classId }) => {
  changeClass(localStore, classId, (row) => ({ ...row, status: "active" }));
};

/** Changes the page of every loaded list of one classroom's teachers that the match accepts. */
function changeTeacherLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  matches: (args: Ref.Args<typeof classroom.teachers.list>) => boolean,
  change: (page: readonly ClassTeacher[]) => ClassTeacher[]
) {
  for (const query of localStore.getAllQueries(classroom.teachers.list)) {
    if (Option.isSome(query.value) && matches(query.args)) {
      localStore.setQuery(
        classroom.teachers.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
      );
    }
  }
}

/**
 * Lists a newly assigned teacher at once, at the end of the first page of the classroom's teachers, named as a
 * loaded page of the school's people names them, which the dialog's picker reads. A teacher the page already lists
 * stays listed once, and with no loaded name the teacher waits for the server.
 */
export const assignTeacherChange: OptimisticUpdate<
  typeof classroom.teachers.assign
> = (localStore, { classId, personId }) => {
  const person = Arr.findFirst(
    localStore.getAllQueries(tenancy.people.list),
    (query) =>
      Option.flatMap(query.value, (value) =>
        Arr.findFirst(value.page, (row) => row.id === personId)
      )
  );
  if (Option.isNone(person)) {
    return;
  }
  const teacher: ClassTeacher = { id: personId, name: person.value.name };
  changeTeacherLists(
    localStore,
    (args) => args.classId === classId && isFirstPage(args),
    (page) =>
      Arr.some(page, (row) => row.id === personId)
        ? Arr.copy(page)
        : Arr.append(page, teacher)
  );
};

/** Takes a removed teacher off every loaded page of the classroom's teachers at once. */
export const removeTeacherChange: OptimisticUpdate<
  typeof classroom.teachers.remove
> = (localStore, { classId, personId }) => {
  changeTeacherLists(
    localStore,
    (args) => args.classId === classId,
    (page) => withoutItem(page, personId)
  );
};
