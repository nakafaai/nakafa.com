import type { Ref } from "@confect/core";
import { useAction, useMutation } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Select,
  SelectContent,
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
import { Array as Arr, Effect, Option, Schema } from "effect";
import { useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { TableFrame } from "@/components/shared/table/frame";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { useTenant } from "@/components/tenant/context";

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
  const [shown, setShown] = useState<Option.Option<Preview>>(Option.none());

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
    <CardSection>
      <CardHeader>
        <CardTitle>{t("courses")}</CardTitle>
        <CardDescription>{t("courses-description")}</CardDescription>
      </CardHeader>
      {Option.match(shown, {
        onNone: () => null,
        onSome: (found) => (
          <CourseTable preview={found} setPreview={setShown} />
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

/** The courses of a preview, each with its students and the class it fills. */
function CourseTable({
  preview,
  setPreview,
}: {
  preview: Preview;
  setPreview: (preview: Option.Option<Preview>) => void;
}) {
  const t = useTranslations("Connectors");

  if (Arr.isReadonlyArrayEmpty(preview.courses)) {
    return (
      <p className="px-6 text-muted-foreground text-sm">{t("courses-none")}</p>
    );
  }

  return (
    <div className="px-6">
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("course")}</TableHead>
              <TableHead className="hidden sm:table-cell">
                {t("course-students")}
              </TableHead>
              <TableHead>{t("course-class")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Arr.map(preview.courses, (course) => (
              <CourseRow
                course={course}
                key={course.courseId}
                preview={preview}
                setPreview={setPreview}
              />
            ))}
          </TableBody>
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
      <TableCell className="font-medium">
        <span className="block truncate" dir="auto">
          {course.section === null
            ? course.name
            : t("course-name", { name: course.name, section: course.section })}
        </span>
      </TableCell>
      <TableCell className="hidden text-muted-foreground sm:table-cell">
        {course.students}
      </TableCell>
      <TableCell>
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
            {Arr.map(items, (item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  );
}
