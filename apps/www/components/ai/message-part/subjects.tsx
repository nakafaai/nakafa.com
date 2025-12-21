import type { DataPart } from "@repo/ai/types/data-parts";
import type {
  NonNumericGrade,
  NumericGrade,
} from "@repo/contents/_types/subject/grade";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Button,
  buttonVariants,
} from "@repo/design-system/components/ui/button";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { cn } from "@repo/design-system/lib/utils";
import {
  ArrowUpRightIcon,
  BookIcon,
  FrownIcon,
  Layers2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useMemo, useState } from "react";

const MAX_SHOWN_SUBJECTS = 5;

interface Props {
  message: DataPart["get-subjects"];
}

export const SubjectsPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");

  const [open, setOpen] = useState(false);

  const isLoading = message.status === "loading";
  const isError = message.status === "error";
  const subjects = message.subjects;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <SpinnerIcon className="size-4 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          {t("get-subjects-loading")}
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2">
        <FrownIcon className="size-4 shrink-0 text-destructive" />
        <span className="text-muted-foreground text-sm">
          {t("get-subjects-error")}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <BookIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground text-sm">
            {t("get-subjects-title")}
          </span>
          <Badge variant="muted">{subjects.length}</Badge>
        </div>
        <SubjectsPartPreview setOpen={setOpen} subjects={subjects} />
      </div>
      <SubjectsPartSheet
        input={message.input}
        open={open}
        setOpen={setOpen}
        subjects={subjects}
      />
    </>
  );
});

const SubjectsPartPreview = memo(
  ({
    subjects,
    setOpen,
  }: {
    subjects: DataPart["get-subjects"]["subjects"];
    setOpen: (open: boolean) => void;
  }) => {
    const t = useTranslations("Ai");

    if (subjects.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        {subjects.slice(0, MAX_SHOWN_SUBJECTS).map((subject) => (
          <NavigationLink
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            href={`/${subject.slug}`}
            key={subject.url}
            target="_blank"
          >
            {subject.title}
            <ArrowUpRightIcon />
          </NavigationLink>
        ))}

        {subjects.length > MAX_SHOWN_SUBJECTS && (
          <Button onClick={() => setOpen(true)} size="sm" variant="outline">
            {t("view-all")}
            <Layers2Icon />
          </Button>
        )}
      </div>
    );
  }
);
SubjectsPartPreview.displayName = "SubjectsPartPreview";

const SubjectsPartSheet = memo(
  ({
    input,
    subjects,
    open,
    setOpen,
  }: {
    input: DataPart["get-subjects"]["input"];
    subjects: DataPart["get-subjects"]["subjects"];
    open: boolean;
    setOpen: (open: boolean) => void;
  }) => {
    const t = useTranslations("Ai");
    const tSubjects = useTranslations("Subject");

    const grade = useMemo(() => {
      // if we can make number from grade, return the grade
      if (!Number.isNaN(Number(input.grade))) {
        return tSubjects("grade", { grade: input.grade as NumericGrade });
      }
      return tSubjects(input.grade as NonNumericGrade);
    }, [input.grade, tSubjects]);

    return (
      <Sheet modal={false} onOpenChange={setOpen} open={open}>
        <SheetContent className="w-full sm:max-w-xl">
          <div className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle className="text-xl">
                {subjects.length} {t("get-subjects-title")}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <Badge variant="muted">{tSubjects(input.category)}</Badge>
                <Badge variant="muted">{grade}</Badge>
                <Badge variant="muted">{tSubjects(input.material)}</Badge>
              </SheetDescription>
            </SheetHeader>

            <Separator />

            <div className="flex flex-1 flex-col overflow-hidden">
              <ScrollArea className="h-full">
                <div className="flex flex-col divide-y overflow-hidden">
                  {subjects.map((subject) => (
                    <NavigationLink
                      className="group flex items-center gap-2 px-4 py-3 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
                      href={`/${subject.slug}`}
                      key={subject.url}
                      target="_blank"
                    >
                      {subject.title}
                      <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity ease-out group-hover:text-accent-foreground group-hover:opacity-100" />
                    </NavigationLink>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }
);
SubjectsPartSheet.displayName = "SubjectsPartSheet";
