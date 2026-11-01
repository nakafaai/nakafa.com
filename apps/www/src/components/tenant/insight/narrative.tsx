import type { GenericId } from "@confect/core";
import { QueryResult, useMutation } from "@confect/react";
import { NoteEditIcon } from "@hugeicons/core-free-icons";
import insight from "@repo/backend/confect/_generated/refs/insight";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Array as Arr, Option } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "use-intl";
import { createStore, type StoreApi, useStore } from "zustand";
import { TableAction, TableActionName } from "@/components/shared/table/action";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import type { InsightStudent } from "@/components/tenant/insight/rows";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/insight/narrative";

/** The longest narrative, which the server also holds a teacher to. */
const NARRATIVE_LIMIT = 4000;

/** The student whose narrative is open, and whether it still shows. */
interface NarrativeChoice {
  readonly choose: (id: InsightStudent["id"]) => void;
  readonly chosen: InsightStudent["id"] | null;
  readonly close: () => void;
  readonly isOpen: boolean;
}

/** Creates the choice of one class's page. The student stays chosen after a close, so the dialog leaves whole. */
const createNarrativeChoice = () =>
  createStore<NarrativeChoice>()((set) => ({
    choose: (id) => set({ chosen: id, isOpen: true }),
    chosen: null,
    close: () => set({ isOpen: false }),
    isOpen: false,
  }));

const NarrativeContext = createContext<StoreApi<NarrativeChoice> | null>(null);

/** Reads one selected slice of the page's narrative choice. */
function useNarrativeChoice<T>(selector: (state: NarrativeChoice) => T) {
  const store = use(NarrativeContext);

  if (store === null) {
    throw new Error(
      "useNarrativeChoice must be used within NarrativeProvider"
    );
  }

  return useStore(store, selector);
}

/** Gives a class's page its one narrative dialog, which any row of any of its tabs opens. */
export function NarrativeProvider({
  children,
  classId,
  students,
}: {
  children: ReactNode;
  classId: GenericId.GenericId<"classes">;
  students: readonly InsightStudent[];
}) {
  const [store] = useState(createNarrativeChoice);

  return (
    <NarrativeContext value={store}>
      {children}
      <ChosenNarrative classId={classId} students={students} />
    </NarrativeContext>
  );
}

/** The action of a row that names a student: their narrative. */
export function NarrativeButton({ id }: { id: InsightStudent["id"] }) {
  const t = useTranslations("SchoolInsight");
  const choose = useNarrativeChoice((state) => state.choose);

  return (
    <TableAction onClick={() => choose(id)} type="button">
      <HugeIcons icon={NoteEditIcon} />
      <TableActionName>{t("narrative-open")}</TableActionName>
    </TableAction>
  );
}

/** The dialog of the chosen student, one for the whole page, so a long class draws no dialog per row. */
function ChosenNarrative({
  classId,
  students,
}: {
  classId: GenericId.GenericId<"classes">;
  students: readonly InsightStudent[];
}) {
  const chosen = useNarrativeChoice((state) => state.chosen);
  const student = Arr.findFirst(students, ({ id }) => id === chosen);

  return Option.isSome(student) ? (
    <StudentNarrative
      classId={classId}
      key={student.value.id}
      student={student.value}
    />
  ) : null;
}

/**
 * One student's narrative: the teacher writes it, shares it with the guardians, and takes it back from the same place.
 * Nina can draft it from the student's numbers, and the teacher reads the draft and takes it into their own words.
 */
function StudentNarrative({
  classId,
  student,
}: {
  classId: GenericId.GenericId<"classes">;
  student: InsightStudent;
}) {
  const t = useTranslations("SchoolInsight");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const viewer = useViewerQuery();
  const open = useNarrativeChoice((state) => state.isOpen);
  const close = useNarrativeChoice((state) => state.close);
  const names = { classId, personId: student.id, slug };
  const write = useMutation(insight.narratives.write);
  const share = useMutation(insight.narratives.share);
  const withdraw = useMutation(insight.narratives.withdraw);
  const ask = useMutation(insight.drafts.ask);
  const [text, setText] = useState(student.narrative?.text ?? "");
  const [isSaving, startSaving] = useTransition();
  const [asked, setAsked] = useOptimistic(student.draft !== null);
  const shared = student.narrative?.shared === true;
  const saved = student.narrative !== null;
  const ninaOn =
    QueryResult.isSuccess(viewer) && viewer.value.tenant.policies.nina;
  const draft = student.draft?.text ?? null;

  return (
    <ResponsiveDialog
      description={t("narrative-description")}
      footer={
        <>
          <Button onClick={close} type="button" variant="outline">
            {common("cancel")}
          </Button>
          {ninaOn ? (
            <Button
              disabled={asked && draft === null}
              onClick={() =>
                startSaving(async () => {
                  setAsked(true);
                  await saveSchool(() => ask(names), SOURCE);
                })
              }
              type="button"
              variant="outline"
            >
              {t("narrative-ask")}
            </Button>
          ) : null}
          {saved ? (
            <Button
              disabled={isSaving}
              onClick={() =>
                startSaving(() =>
                  saveSchool(
                    () => (shared ? withdraw(names) : share(names)),
                    SOURCE
                  )
                )
              }
              type="button"
              variant="outline"
            >
              {shared ? t("narrative-withdraw") : t("narrative-share")}
            </Button>
          ) : null}
          <Button
            disabled={isSaving || text.trim() === ""}
            onClick={() =>
              startSaving(() =>
                saveSchool(() => write({ ...names, text: text.trim() }), SOURCE)
              )
            }
            type="button"
          >
            {t("narrative-save")}
          </Button>
        </>
      }
      open={open}
      setOpen={close}
      title={t("narrative-title", { student: student.name })}
    >
      <div className="flex flex-col gap-3">
        {asked && draft === null ? (
          <p className="text-muted-foreground text-sm">
            {t("narrative-drafting")}
          </p>
        ) : null}
        {draft === null ? null : (
          <div className="flex flex-col items-start gap-2">
            <p className="text-muted-foreground text-sm">
              {t("narrative-draft")}
            </p>
            <p className="text-sm" dir="auto">
              {draft}
            </p>
            <Button
              onClick={() => setText(draft)}
              type="button"
              variant="outline"
            >
              {t("narrative-use")}
            </Button>
          </div>
        )}
        <Textarea
          aria-label={t("narrative-title", { student: student.name })}
          maxLength={NARRATIVE_LIMIT}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("narrative-placeholder")}
          rows={6}
          value={text}
        />
      </div>
    </ResponsiveDialog>
  );
}
