import type { Ref } from "@confect/core";
import { useAction, useMutation } from "@confect/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import { Id } from "@repo/backend/confect/_generated/id";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { Button } from "@repo/design-system/components/ui/button";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { buttonVariants } from "@repo/design-system/lib/button";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { type ReactNode, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { useTenant } from "@/components/tenant/context";
import { GRADE_ICONS } from "@/components/tenant/settings/choices";
import { saveSchool } from "@/components/tenant/settings/save";
import { Link } from "@/lib/routing/link";

const SOURCE = "components/tenant/connectors/classroom";

/** What a preview answers: the school's classes, its connection, and the courses it teaches. */
type Preview = NonNullable<Ref.Returns<typeof connectors.classroom.preview>>;

/** The value of the class picker that leaves a course unlinked. */
const UNLINKED = "none";

/**
 * The work a connected Classroom opens (journey J7): the courses that the school's connection
 * teaches, each with its students and the class it fills. Picking a class links the course at once,
 * and its coursework arrives as the class's tasks; picking none removes the link. The courses load
 * as the open service shows them, so the page calls Google only when a reader opened it.
 */
export function ClassroomCourses() {
  const t = useTranslations("Connectors");
  const { slug } = useTenant();
  const preview = useAction(connectors.classroom.preview);
  const [isLoading, startLoading] = useTransition();
  const [shown, setShown] = useState<Option.Option<Preview>>(Option.none);

  const load = () =>
    startLoading(() =>
      runForumCall(
        forumCall(() => preview({ slug })).pipe(
          Effect.tap((answer) =>
            Effect.sync(() => setShown(Option.fromNullOr(answer)))
          )
        ),
        toastForumFailure
      )
    );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h3 className="min-w-0 flex-1 text-sm font-medium">{t("courses")}</h3>
        <Button
          aria-label={t("courses-refresh")}
          disabled={isLoading}
          onClick={load}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <Spinner icon={RefreshIcon} isLoading={isLoading} />
        </Button>
      </div>
      <Intersection once onIntersect={load} />
      {Option.match(shown, {
        onNone: () => null,
        onSome: (found) => (
          <>
            {Arr.isReadonlyArrayEmpty(found.classes) &&
            Arr.isReadonlyArrayNonEmpty(found.courses) ? (
              <NoClassToFill />
            ) : null}
            <CourseTable
              classCell={(course) => (
                <CourseClass
                  course={course}
                  preview={found}
                  setPreview={setShown}
                />
              )}
              preview={found}
            />
          </>
        ),
      })}
    </section>
  );
}

/** What a school with no class does first, because a course only fills a class that exists. */
function NoClassToFill() {
  const t = useTranslations("Connectors");
  const { slug } = useTenant();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-muted-foreground text-sm">{t("courses-no-class")}</p>
      <Link
        className={buttonVariants({ variant: "outline" })}
        params={{ slug }}
        to="/school/$slug/settings/classes"
      >
        {t("courses-no-class-action")}
      </Link>
    </div>
  );
}

/** The columns of the courses. */
const courseColumns = tableColumns<Preview["courses"][number]>();

/**
 * The courses of a preview in a table, or a sentence when it has none: each course's name and section, its students,
 * the class it fills, which the caller composes, and the import of a linked course.
 */
function CourseTable({
  classCell,
  preview,
}: {
  classCell: (course: Preview["courses"][number]) => ReactNode;
  preview: Preview;
}) {
  const t = useTranslations("Connectors");
  const classOf = (course: Preview["courses"][number]) =>
    Option.getOrElse(
      Option.map(
        Arr.findFirst(preview.classes, (klass) => klass.id === course.classId),
        (klass) => klass.name
      ),
      () => t("course-unlinked")
    );

  if (Arr.isReadonlyArrayEmpty(preview.courses)) {
    return <p className="text-muted-foreground text-sm">{t("courses-none")}</p>;
  }

  return (
    <TableFiltersProvider>
      <div className="-mx-4 border-t [&_[data-slot=table-cell]]:whitespace-nowrap">
        <DataTable
          columns={[
            courseColumns.text(
              (course) =>
                course.section === null
                  ? course.name
                  : t("course-name", {
                      name: course.name,
                      section: course.section,
                    }),
              {
                cell: (info) => (
                  <span className="font-medium" dir="auto">
                    {info.getValue()}
                  </span>
                ),
                header: t("course"),
                id: "course",
              }
            ),
            courseColumns.number((course) => course.students, {
              cell: (info) => (
                <span className="text-muted-foreground">{info.getValue()}</span>
              ),
              header: t("course-students"),
              id: "students",
            }),
            courseColumns.values(classOf, {
              cell: (info) => classCell(info.row.original),
              header: t("course-class"),
              id: "class",
              options: namedOptions(
                Arr.dedupe(Arr.map(preview.courses, classOf)),
                GRADE_ICONS
              ),
            }),
            courseColumns.menu((info) =>
              info.row.original.classId === null ? null : (
                <CourseRosterImport courseId={info.row.original.courseId} />
              )
            ),
          ]}
          data={preview.courses}
          rowId={(course) => course.courseId}
        />
      </div>
    </TableFiltersProvider>
  );
}

/** The class a course fills. A new pick shows at once and goes back to the previous one when the server refuses it. */
function CourseClass({
  course,
  preview,
  setPreview,
}: {
  course: Preview["courses"][number];
  preview: Preview;
  setPreview: (preview: Option.Option<Preview>) => void;
}) {
  const t = useTranslations("Connectors");
  const { slug } = useTenant();
  const link = useMutation(connectors.classroom.link);
  const items = [
    { label: t("course-unlinked"), value: UNLINKED },
    ...Arr.map(preview.classes, (klass) => ({
      label: klass.name,
      value: klass.id,
    })),
  ];
  const withClass = (classId: Preview["courses"][number]["classId"]) =>
    Option.some({
      ...preview,
      courses: Arr.map(preview.courses, (row) =>
        row.courseId === course.courseId ? { ...row, classId } : row
      ),
    });

  const pick = (value: unknown) => {
    const picked =
      value === UNLINKED
        ? Option.some(null)
        : Schema.decodeUnknownOption(Id("classes"))(value);
    Option.map(picked, (classId) => {
      setPreview(withClass(classId));
      runForumCall(
        forumCall(() =>
          link({
            classId,
            connectionId: preview.connectionId,
            courseId: course.courseId,
            slug,
          })
        ),
        () => {
          setPreview(withClass(course.classId));
          toastForumFailure();
        }
      );
    });
  };

  return (
    <Select
      disabled={
        course.classId === null && Arr.isReadonlyArrayEmpty(preview.classes)
      }
      items={items}
      onValueChange={pick}
      value={course.classId ?? UNLINKED}
    >
      <SelectTrigger aria-label={t("course-class")} className="w-full min-w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {Arr.map(items, (item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** Imports the students of a linked course into the class group of its class. */
function CourseRosterImport({ courseId }: { courseId: string }) {
  const t = useTranslations("Connectors");
  const { slug } = useTenant();
  const importRoster = useAction(connectors.classroom.importRoster);
  const [isImporting, startImporting] = useTransition();

  return (
    <Button
      disabled={isImporting}
      onClick={() =>
        startImporting(() =>
          saveSchool(
            () => importRoster({ courseId, slug }),
            SOURCE,
            () => toast.success({ title: "school-roster-imported.title" })
          )
        )
      }
      size="sm"
      type="button"
      variant="outline"
    >
      {t("course-import")}
    </Button>
  );
}
