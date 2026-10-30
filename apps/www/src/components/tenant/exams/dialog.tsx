import { useMutation } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  EXAM_TITLE_MAX_LENGTH,
  ExamTitle,
} from "@repo/backend/confect/exams/exam";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useNavigate } from "@tanstack/react-router";
import {
  Array as Arr,
  Clock,
  Effect,
  Function as Fn,
  Option,
  Schema,
  String as Str,
} from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useId,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "use-intl";
import type { StoreApi } from "zustand";
import { useConvexAuth } from "@/components/auth/convex";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import {
  choiceKey,
  defaultChoice,
  type ScopeChoice,
} from "@/components/tenant/exams/create";
import type { ExamDrafts } from "@/components/tenant/exams/drafts";
import { useImportFile } from "@/components/tenant/exams/import/calls";
import { ImportFileField } from "@/components/tenant/exams/import/field";
import { titleOfFile } from "@/components/tenant/exams/import/file";
import { insertDraftExam } from "@/components/tenant/exams/optimistic";
import { placeholderExamId } from "@/components/tenant/exams/placeholder";

/**
 * The drafts of the list or the home that holds the create action: the exams the server is still saving,
 * which the action starts and ends, and which their rows read.
 */
const ExamDraftsContext = createContext<StoreApi<ExamDrafts> | null>(null);

/** Gives the page's create action and rows the drafts that the page creates once. */
export function ExamDraftsProvider({
  children,
  drafts,
}: {
  children: ReactNode;
  drafts: StoreApi<ExamDrafts>;
}) {
  return <ExamDraftsContext value={drafts}>{children}</ExamDraftsContext>;
}

/** Reads the page's drafts. It throws outside a page that provides them. */
function useExamDrafts() {
  const drafts = use(ExamDraftsContext);
  if (drafts === null) {
    throw new Error("useExamDrafts must be used within ExamDraftsProvider");
  }
  return drafts;
}

/**
 * The button and the dialog that create an exam. The dialog asks for the title and the place,
 * and takes a Word or PDF file when the teacher has the questions already. The new exam shows in
 * the list at once, as a placeholder that is inert until the server answers, and then the page
 * goes to its editor, where the file's questions appear as Nina reads them (K27). A refused
 * create leaves the list as it was, and shows the action-error toast.
 */
export function CreateExam({
  choices,
  slug,
}: {
  choices: readonly ScopeChoice[];
  slug: TenantSlug;
}) {
  const drafts = useExamDrafts();
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const navigate = useNavigate();
  const create = useMutation(exams.exams.create);
  const importFile = useImportFile(slug);
  // A create sent before Convex holds the session's token is refused as signed out, so the
  // dialog's submit waits for Convex to answer for the session.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const unitItems = Arr.map(choices, (current) => ({
    label: current.unitName ?? t("whole-school"),
    value: choiceKey(current),
  }));

  const choice = Option.orElse(
    Arr.findFirst(choices, (current) => choiceKey(current) === picked),
    () => defaultChoice(choices)
  );
  const name = Str.trim(title);
  // A title the schema refuses is either empty or too long: the input is one line, and it is trimmed.
  const titleTooLong = name !== "" && !Schema.is(ExamTitle)(name);
  const ready = Option.isSome(choice) && Schema.is(ExamTitle)(name);

  /** Opens or closes the dialog. A closed dialog forgets its file, so the next exam starts without one. */
  const show = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setFile(null);
    }
  };

  /**
   * Creates the exam, shows it at once, and goes to its editor once the server saves it. The
   * dialog closes at once, and the create button stays inert until the save settles, so a second
   * press during the close cannot save a second exam.
   */
  const submit = () => {
    if (!(ready && isSettled) || Option.isNone(choice)) {
      return;
    }
    const { scope } = choice.value;
    show(false);
    startTransition(() =>
      runExamAction(
        placeholderExamId.pipe(
          Effect.flatMap((draftId) =>
            Effect.flatMap(Clock.currentTimeMillis, (createdAt) => {
              drafts.getState().start(draftId);
              return sentAction(() =>
                create.withOptimisticUpdate(
                  insertDraftExam({ createdAt, id: draftId, title: name })
                )({ scope, slug, title: name })
              ).pipe(
                Effect.ensuring(
                  Effect.sync(() => drafts.getState().end(draftId))
                )
              );
            })
          ),
          Effect.tap((saved) =>
            Effect.sync(() => {
              navigate({
                params: { exam: saved.id, slug },
                to: "/school/$slug/exams/$exam/edit",
              });
            })
          ),
          // The import outlives this dialog and the page it opened from, so it runs detached.
          Effect.tap((saved) =>
            file === null ? Effect.void : importFile(saved.id, file)
          )
        ),
        { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
      )
    );
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("create")}</Button>
      <ResponsiveDialog
        description={t("create-description")}
        footer={
          <>
            <Button onClick={() => show(false)} variant="outline">
              {common("cancel")}
            </Button>
            <Button
              disabled={!(ready && isSettled) || isPending}
              inert={isPending}
              onClick={submit}
            >
              {t("create")}
            </Button>
          </>
        }
        open={open}
        setOpen={show}
        title={t("create")}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-title`}>{t("title-label")}</FieldLabel>
            <Input
              dir="auto"
              id={`${id}-title`}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("untitled")}
              value={title}
            />
            {name === "" ? (
              <FieldDescription>{t("title-needed")}</FieldDescription>
            ) : null}
            {titleTooLong ? (
              <FieldDescription>
                {t("title-too-long", { count: EXAM_TITLE_MAX_LENGTH })}
              </FieldDescription>
            ) : null}
          </Field>
          <ImportFileField
            description={t("import-description")}
            file={file}
            onFile={(chosen) => {
              setFile(chosen);
              if (chosen !== null && name === "") {
                setTitle(Option.getOrElse(titleOfFile(chosen.name), () => ""));
              }
            }}
          />
          <Field>
            <FieldLabel htmlFor={`${id}-unit`}>{t("unit")}</FieldLabel>
            <Select
              items={unitItems}
              onValueChange={(key) => setPicked(key)}
              value={Option.getOrNull(Option.map(choice, choiceKey))}
            >
              <SelectTrigger className="w-full" id={`${id}-unit`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Arr.map(unitItems, (item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}
