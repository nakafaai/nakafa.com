import type { Ref } from "@confect/core";
import { useAction, useMutation } from "@confect/react";
import {
  Mortarboard01Icon,
  MoreHorizontalIcon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";
import { Id } from "@repo/backend/confect/_generated/id";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { buttonVariants } from "@repo/design-system/lib/button";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { type ReactNode, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty } from "@/components/shared/table/frame";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
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

/** One course of a preview. */
type Course = Preview["courses"][number];

/** The value of the class picker that leaves a course unlinked. */
const UNLINKED = "none";

/**
 * The work a connected Classroom opens (journey J7): the courses that the school's connection
 * teaches, each with its students and the class it fills, edge to edge in the pane's body. A course's
 * menu links it to a class at once, and its coursework arrives as the class's tasks; picking none
 * removes the link. The courses load each time the open service shows them, so the page calls Google
 * only when a reader opened it, and opening it again reads Google again.
 */
export function ClassroomCourses() {
  const { slug } = useTenant();
  const preview = useAction(connectors.classroom.preview);
  const [isLoading, startLoading] = useTransition();
  const [hasFailed, setHasFailed] = useState(false);
  const [shown, setShown] = useState<Option.Option<Preview>>(Option.none);

  const load = () =>
    startLoading(() =>
      runForumCall(
        forumCall(() => preview({ slug })).pipe(
          Effect.tap((answer) =>
            Effect.sync(() => {
              setHasFailed(answer === null);
              setShown(Option.fromNullOr(answer));
            })
          )
        ),
        () => setHasFailed(true)
      )
    );

  return (
    <>
      <Intersection once onIntersect={load} />
      {Option.match(shown, {
        onNone: () =>
          hasFailed ? (
            <LoadFailure isPending={isLoading} onRetry={load} />
          ) : (
            <CoursesLoading />
          ),
        onSome: (found) => (
          <CourseTable
            menu={(course) => (
              <CourseMenu>
                <CourseClass
                  course={course}
                  preview={found}
                  setPreview={setShown}
                />
                {course.classId === null ? null : (
                  <CourseRosterImport courseId={course.courseId} />
                )}
              </CourseMenu>
            )}
            preview={found}
          />
        ),
      })}
    </>
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

/** What a school with no class does first, because a course only fills a class that exists. */
function NoClassToFill() {
  const t = useTranslations("Connectors");
  const { slug } = useTenant();

  return (
    <TableEmpty
      act="pointing"
      action={
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{ slug }}
          to="/school/$slug/settings/classes"
        >
          {t("courses-no-class-action")}
        </Link>
      }
      description={t("courses-no-class")}
      title={t("courses-no-class-title")}
    />
  );
}

/** The columns of the courses. */
const courseColumns = tableColumns<Course>();

/**
 * The courses of a preview in a table, or the empty state when it has none or the school has no class for them: each
 * course's name and section, its students, the class it fills, and its menu, which the caller composes. A course linked
 * to a class the school archived names that, so a cell never shows the class's raw ID.
 */
function CourseTable({
  menu,
  preview,
}: {
  menu: (course: Course) => ReactNode;
  preview: Preview;
}) {
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
  if (Arr.isReadonlyArrayEmpty(preview.classes)) {
    return <NoClassToFill />;
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
            header: t("course-class"),
            id: "class",
            options: namedOptions(
              Arr.dedupe(Arr.map(preview.courses, classOf)),
              GRADE_ICONS
            ),
          }),
          courseColumns.menu((info) => menu(info.row.original)),
        ]}
        data={preview.courses}
        plain
        rowId={(course) => course.courseId}
      />
    </TableFiltersProvider>
  );
}

/** A course's one action: the ghost three dots, opening what it can do, which the caller composes. */
function CourseMenu({ children }: { children: ReactNode }) {
  const t = useTranslations("Connectors");
  const common = useTranslations("Common");

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("course")}</DropdownMenuLabel>
            {children}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** The class a course fills. A new pick shows at once and goes back to the previous one when the server refuses it. */
function CourseClass({
  course,
  preview,
  setPreview,
}: {
  course: Course;
  preview: Preview;
  setPreview: (preview: Option.Option<Preview>) => void;
}) {
  const t = useTranslations("Connectors");
  const { slug } = useTenant();
  const link = useMutation(connectors.classroom.link);
  const withClass = (classId: Course["classId"]) =>
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
