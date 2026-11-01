import { useAction, useMutation } from "@confect/react";
import {
  Mortarboard01Icon,
  Refresh03Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";
import { Id } from "@repo/backend/confect/_generated/id";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { buttonVariants } from "@repo/design-system/lib/button";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Option, Schema } from "effect";
import { useTransition } from "react";
import { useTranslations } from "use-intl";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty } from "@/components/shared/table/frame";
import { RowItems } from "@/components/shared/table/menu";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import {
  type Course,
  type Preview,
  useCourses,
  useLoadCourses,
} from "@/components/tenant/connectors/courses";
import { useTenant } from "@/components/tenant/context";
import { GRADE_ICONS } from "@/components/tenant/settings/choices";
import { saveSchool } from "@/components/tenant/settings/save";
import { Link } from "@/lib/routing/link";

const SOURCE = "components/tenant/connectors/classroom";

/** The value of the class picker that leaves a course unlinked. */
const UNLINKED = "none";

/** Whether a preview's courses wait for a class, because the school has none for them to fill. */
const needsClass = ({ classes, courses }: Preview) =>
  Arr.isReadonlyArrayNonEmpty(courses) && Arr.isReadonlyArrayEmpty(classes);

/**
 * The work a connected Classroom opens (journey J7): the courses that the school's connection
 * teaches, each with its students and the class it fills, edge to edge in the pane's body. A course's
 * menu links it to a class at once, and its coursework arrives as the class's tasks; picking none
 * removes the link. The courses load each time the open service shows them, so the page calls Google
 * only when a reader opened it, and opening it again reads Google again.
 */
export function ClassroomCourses() {
  const { load } = useLoadCourses();
  const hasFailed = useCourses((state) => state.hasFailed);
  const preview = useCourses((state) => state.preview);

  return (
    <>
      <Intersection once onIntersect={load} />
      {Option.match(preview, {
        onNone: () => (hasFailed ? <LoadFailure /> : <CoursesLoading />),
        onSome: (found) => <CourseTable preview={found} />,
      })}
    </>
  );
}

/** What the courses ask for next, in the footer as every button of a pane: the classes they wait for, or a new read. */
export function CoursesAction() {
  const hasFailed = useCourses((state) => state.hasFailed);
  const preview = useCourses((state) => state.preview);

  if (Option.exists(preview, needsClass)) {
    return <OpenClasses />;
  }

  return hasFailed && Option.isNone(preview) ? <RetryCourses /> : null;
}

/** Reads the courses again after a read that failed. */
function RetryCourses() {
  const t = useTranslations("Common");
  const { isLoading, load } = useLoadCourses();

  return (
    <Button disabled={isLoading} onClick={load} type="button">
      <Spinner icon={Refresh03Icon} isLoading={isLoading} />
      {t("retry")}
    </Button>
  );
}

/** Opens the school's classes, because a course only fills a class that exists. */
function OpenClasses() {
  const t = useTranslations("Connectors");
  const { slug } = useTenant();

  return (
    <Link
      className={buttonVariants()}
      params={{ slug }}
      to="/school/$slug/settings/classes"
    >
      {t("courses-no-class-action")}
    </Link>
  );
}

/** The body while Google reads the courses. */
function CoursesLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner />
    </div>
  );
}

/** The columns of the courses. */
const courseColumns = tableColumns<Course>();

/**
 * The courses of a preview in a table, or the empty state when it has none or the school has no class for them: each
 * course's name and section, the class it fills, its students, and its menu. A course linked to a class the school
 * archived names that, so a cell never shows the class's raw ID.
 */
function CourseTable({ preview }: { preview: Preview }) {
  const t = useTranslations("Connectors");
  const classOf = (course: Course) =>
    course.classId === null
      ? t("course-unlinked")
      : Option.getOrElse(
          Option.map(
            Arr.findFirst(
              preview.classes,
              (klass) => klass.id === course.classId
            ),
            (klass) => klass.name
          ),
          () => t("course-archived")
        );

  if (Arr.isReadonlyArrayEmpty(preview.courses)) {
    return (
      <TableEmpty
        act="searching"
        description={t("courses-none")}
        title={t("courses-none-title")}
      />
    );
  }
  if (needsClass(preview)) {
    return (
      <TableEmpty
        act="pointing"
        description={t("courses-no-class")}
        title={t("courses-no-class-title")}
      />
    );
  }

  return (
    <TableFiltersProvider>
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
                <span
                  className="block max-w-40 truncate font-medium"
                  dir="auto"
                  title={info.getValue()}
                >
                  {info.getValue()}
                </span>
              ),
              header: t("course"),
              id: "course",
            }
          ),
          courseColumns.values(classOf, {
            cell: (info) => (
              <span
                className="mx-auto block max-w-28 truncate"
                dir="auto"
                title={info.getValue()}
              >
                {info.getValue()}
              </span>
            ),
            header: t("course-class"),
            id: "class",
            options: namedOptions(
              Arr.dedupe(Arr.map(preview.courses, classOf)),
              GRADE_ICONS
            ),
          }),
          courseColumns.number((course) => course.students, {
            cell: (info) => (
              <span className="text-muted-foreground">{info.getValue()}</span>
            ),
            header: t("course-students"),
            id: "students",
          }),
          courseColumns.menu(({ row: { original: course } }) => (
            <RowItems>
              <CourseClass course={course} preview={preview} />
              {course.classId === null ? null : (
                <CourseRosterImport courseId={course.courseId} />
              )}
            </RowItems>
          )),
        ]}
        data={preview.courses}
        plain
        rowId={(course) => course.courseId}
      />
    </TableFiltersProvider>
  );
}

/** The class a course fills. A new pick shows at once and goes back to the previous one when the server refuses it. */
function CourseClass({
  course,
  preview,
}: {
  course: Course;
  preview: Preview;
}) {
  const t = useTranslations("Connectors");
  const { slug } = useTenant();
  const link = useMutation(connectors.classroom.link);
  const place = useCourses((state) => state.place);

  const pick = (value: unknown) => {
    const picked =
      value === UNLINKED
        ? Option.some(null)
        : Schema.decodeUnknownOption(Id("classes"))(value);
    Option.map(picked, (classId) => {
      place(course.courseId, classId);
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
          place(course.courseId, course.classId);
          toastForumFailure();
        }
      );
    });
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <HugeIcons icon={Mortarboard01Icon} />
        {t("course-class")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("course-class")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={pick}
            value={course.classId ?? UNLINKED}
          >
            <DropdownMenuRadioItem value={UNLINKED}>
              {t("course-unlinked")}
            </DropdownMenuRadioItem>
            {Arr.map(preview.classes, (klass) => (
              <DropdownMenuRadioItem key={klass.id} value={klass.id}>
                {klass.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** Imports the students of a linked course into the class group of its class. */
function CourseRosterImport({ courseId }: { courseId: string }) {
  const t = useTranslations("Connectors");
  const { slug } = useTenant();
  const importRoster = useAction(connectors.classroom.importRoster);
  const [isImporting, startImporting] = useTransition();

  return (
    <DropdownMenuItem
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
    >
      <Spinner icon={UserAdd01Icon} isLoading={isImporting} />
      {t("course-import")}
    </DropdownMenuItem>
  );
}
