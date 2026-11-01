import type { Ref } from "@confect/core";
import { useAction, useMutation } from "@confect/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";
import { Id } from "@repo/backend/confect/_generated/id";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { type ReactNode, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { columnAlign } from "@/components/shared/table/align";
import { TableFrame } from "@/components/shared/table/frame";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { useTenant } from "@/components/tenant/context";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/connectors/classroom";

/** What a preview answers: the school's classes, its connection, and the courses it teaches. */
type Preview = NonNullable<Ref.Returns<typeof connectors.classroom.preview>>;

/** The value of the class picker that leaves a course unlinked. */
const UNLINKED = "none";

/**
 * The next step of a connected Classroom (journey J7): a sheet of the courses that the school's
 * connection teaches, each with its students and the class it fills. Picking a class links the
 * course at once, and its coursework arrives as the class's tasks; picking none removes the link.
 * The courses load when the viewer points at the button, so the sheet opens ready and the page
 * calls Google only on intent.
 */
export function ClassroomImport() {
  const t = useTranslations("Connectors");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const preview = useAction(connectors.classroom.preview);
  const [isLoading, startLoading] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
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
  const loadOnce = () => {
    if (Option.isNone(shown) && !isLoading) {
      load();
    }
  };

  return (
    <>
      <Button
        onClick={() => {
          loadOnce();
          setIsOpen(true);
        }}
        onFocus={loadOnce}
        onPointerEnter={loadOnce}
        size="sm"
        type="button"
      >
        {t("courses-import")}
      </Button>
      <Sheet onOpenChange={setIsOpen} open={isOpen}>
        <SheetContent className="w-full max-w-none sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{t("courses")}</SheetTitle>
            <SheetDescription>{t("courses-description")}</SheetDescription>
          </SheetHeader>
          {Option.match(shown, {
            onNone: () => null,
            onSome: (found) => (
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
            ),
          })}
          <SheetFooter>
            <Button
              disabled={isLoading}
              onClick={load}
              type="button"
              variant="outline"
            >
              <Spinner icon={RefreshIcon} isLoading={isLoading} />
              {t("courses-refresh")}
            </Button>
            <SheetClose
              render={
                <Button type="button" variant="outline">
                  {common("close")}
                </Button>
              }
            />
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
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
              <SelectLabel>{t("course-class")}</SelectLabel>
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
