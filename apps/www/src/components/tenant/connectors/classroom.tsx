import type { Ref } from "@confect/core";
import { useAction, useMutation } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { buttonVariants } from "@repo/design-system/lib/button";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { type ReactNode, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { columnAlign } from "@/components/shared/table/align";
import { TableFrame } from "@/components/shared/table/frame";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { useTenant } from "@/components/tenant/context";
import { saveSchool } from "@/components/tenant/settings/save";
import { Link } from "@/lib/routing/link";

const SOURCE = "components/tenant/connectors/classroom";

/** What a preview answers: the school's classes, its connection, and the courses it teaches. */
type Preview = NonNullable<Ref.Returns<typeof connectors.classroom.preview>>;

/** The value of the class picker that leaves a course unlinked. */
const UNLINKED = "none";

/**
 * The Classroom import of the school (journey J7): the courses that the school's
 * Classroom connection teaches, each with its students, and the class it fills.
 * Picking a class links the course at once, and its coursework arrives as the
 * class's tasks; picking none removes the link. The courses load when asked, so
 * the page calls Google only on intent.
 */
export function ClassroomImport() {
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
    <CardSection description={t("courses-description")} title={t("courses")}>
      {Option.match(shown, {
        onNone: () => null,
        onSome: (found) => (
          <>
            {Arr.isReadonlyArrayEmpty(found.classes) &&
            Arr.isReadonlyArrayNonEmpty(found.courses) ? (
              <NoClassToFill />
            ) : null}
            <CourseTable empty={Arr.isReadonlyArrayEmpty(found.courses)}>
              {Arr.map(found.courses, (course) => (
                <CourseRow
                  course={course}
                  key={course.courseId}
                  preview={found}
                  setPreview={setShown}
                />
              ))}
            </CourseTable>
          </>
        ),
      })}
      <CardSectionFooter hint={t("courses-hint")}>
        <Button disabled={isLoading} onClick={load} variant="outline">
          {Option.isSome(shown) ? t("courses-refresh") : t("courses-show")}
        </Button>
      </CardSectionFooter>
    </CardSection>
  );
}

/** What a school with no class does first, because a course only fills a class that exists. */
function NoClassToFill() {
  const t = useTranslations("Connectors");
  const { slug } = useTenant();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-6">
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

/** The courses of a preview in a table, each row composed by the import, or a sentence when it has none. */
function CourseTable({
  children,
  empty,
}: {
  children: ReactNode;
  empty: boolean;
}) {
  const t = useTranslations("Connectors");

  if (empty) {
    return (
      <p className="text-muted-foreground px-6 text-sm">{t("courses-none")}</p>
    );
  }

  return (
    <div className="px-6">
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={columnAlign({ align: "start" })}>
                {t("course")}
              </TableHead>
              <TableHead
                className={columnAlign({ className: "hidden sm:table-cell" })}
              >
                {t("course-students")}
              </TableHead>
              <TableHead className={columnAlign()}>
                {t("course-class")}
              </TableHead>
              <TableHead className={columnAlign()} />
            </TableRow>
          </TableHeader>
          <TableBody>{children}</TableBody>
        </Table>
      </TableFrame>
    </div>
  );
}

/**
 * One course: its name and section, its students, and the class it fills. A new
 * pick shows at once and goes back to the previous one when the server refuses it.
 */
function CourseRow({
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
    <TableRow>
      <TableCell
        className={columnAlign({ align: "start", className: "font-medium" })}
        dir="auto"
      >
        {course.section === null
          ? course.name
          : t("course-name", { name: course.name, section: course.section })}
      </TableCell>
      <TableCell
        className={columnAlign({
          className: "text-muted-foreground hidden sm:table-cell",
        })}
      >
        {course.students}
      </TableCell>
      <TableCell className={columnAlign()}>
        <Select
          disabled={
            course.classId === null && Arr.isReadonlyArrayEmpty(preview.classes)
          }
          items={items}
          onValueChange={pick}
          value={course.classId ?? UNLINKED}
        >
          <SelectTrigger
            aria-label={t("course-class")}
            className="w-full min-w-40"
          >
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
      </TableCell>
      <TableCell className={columnAlign()}>
        {course.classId === null ? null : (
          <CourseRosterImport courseId={course.courseId} />
        )}
      </TableCell>
    </TableRow>
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
