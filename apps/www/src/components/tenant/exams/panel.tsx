import { Layers01Icon } from "@hugeicons/core-free-icons";
import { useMediaQuery } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { Option } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "use-intl";
import { createStore, type StoreApi, useStore } from "zustand";
import { useActiveQuestion } from "@/components/tenant/exams/provider";

/**
 * Where the teacher's layer of the chosen question opens: the body of the side panel on a wide
 * screen, and the body of the sheet while a phone holds it open. Both are elements, which no
 * Schema describes, so the state is a plain shape.
 */
interface ExamPanel {
  /** Whether the phone's sheet is open. */
  readonly open: boolean;
  /** The body of the side panel, while a wide screen shows it. */
  readonly panel: HTMLElement | null;
  readonly setOpen: (open: boolean) => void;
  readonly setPanel: (element: HTMLElement | null) => void;
  readonly setSheet: (element: HTMLElement | null) => void;
  /** The body of the phone's sheet, while it is open. */
  readonly sheet: HTMLElement | null;
}

/** Creates the places of one editor's teacher layer. The sheet starts closed. */
const createExamPanel = () =>
  createStore<ExamPanel>()((set) => ({
    open: false,
    panel: null,
    setOpen: (open) => set({ open }),
    setPanel: (panel) => set({ panel }),
    setSheet: (sheet) => set({ sheet }),
    sheet: null,
  }));

const PanelContext = createContext<StoreApi<ExamPanel> | null>(null);

/** Gives the editor the places its teacher layer opens in, created once for this editor. */
export function ExamPanelProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createExamPanel);

  return <PanelContext value={store}>{children}</PanelContext>;
}

/** Reads one selected slice of the places of the teacher layer. */
function useExamPanel<T>(selector: (state: ExamPanel) => T) {
  const store = use(PanelContext);

  if (store === null) {
    throw new Error("useExamPanel must be used within ExamPanelProvider");
  }

  return useStore(store, selector);
}

/** The name of the panel and the question it holds, which its header shows on two lines. */
function PanelHeading() {
  const t = useTranslations("Exams");
  const active = useActiveQuestion();

  return (
    <>
      <h2 className="font-medium text-sm">{t("teacher-layer")}</h2>
      {Option.match(active, {
        onNone: () => null,
        onSome: (page) => (
          <p className="text-muted-foreground text-sm">
            {t("question", { number: page.index + 1 })}
          </p>
        ),
      })}
    </>
  );
}

/**
 * The second screen of the editor, beside the canvas on a wide screen: the points, the key, the rubric,
 * and the explanation of the chosen question. The canvas holds only what the student reads, so all
 * that the teacher alone sees stands here. The chosen page draws its layer into the panel's body, so
 * the page keeps one writer for its options and its key. The body takes the layer only on a wide
 * screen, where the panel shows, so a phone opens no editor it cannot see.
 */
export function ExamPanel() {
  const t = useTranslations("Exams");
  const wide = useMediaQuery(TAILWIND_MEDIA_QUERIES.lgAndUp);
  const setPanel = useExamPanel((state) => state.setPanel);

  return (
    <aside
      aria-label={t("teacher-layer")}
      className="flex h-full min-w-0 flex-col bg-background"
    >
      <header className="flex min-h-12 shrink-0 flex-col justify-center gap-0.5 border-b px-4 py-2">
        <PanelHeading />
      </header>
      <div
        className="min-h-0 flex-1 overflow-y-auto p-4"
        ref={wide ? setPanel : null}
      />
    </aside>
  );
}

/** The footer's action that opens the teacher layer in a sheet on a phone, where no panel shows. */
export function ExamPanelButton() {
  const t = useTranslations("Exams");
  const open = useExamPanel((state) => state.open);
  const setOpen = useExamPanel((state) => state.setOpen);

  return (
    <Button
      aria-pressed={open}
      className="lg:hidden"
      onClick={() => setOpen(true)}
      size="sm"
      type="button"
      variant="ghost"
    >
      <HugeIcons aria-hidden="true" icon={Layers01Icon} />
      {t("teacher-layer")}
    </Button>
  );
}

/** The phone's sheet of the teacher layer, from the bottom of the screen, which the footer opens. */
export function ExamPanelSheet() {
  const t = useTranslations("Exams");
  const active = useActiveQuestion();
  const open = useExamPanel((state) => state.open);
  const setOpen = useExamPanel((state) => state.setOpen);
  const setSheet = useExamPanel((state) => state.setSheet);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{t("teacher-layer")}</SheetTitle>
          {Option.match(active, {
            onNone: () => null,
            onSome: (page) => (
              <SheetDescription>
                {t("question", { number: page.index + 1 })}
              </SheetDescription>
            ),
          })}
        </SheetHeader>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-6"
          ref={setSheet}
        />
      </SheetContent>
    </Sheet>
  );
}

/** Draws the teacher layer of the chosen page in the open sheet, else in the side panel, else nowhere. */
export function TeacherPortal({ children }: { children: ReactNode }) {
  const target = useExamPanel((state) => state.sheet ?? state.panel);

  return target === null ? null : createPortal(children, target);
}
