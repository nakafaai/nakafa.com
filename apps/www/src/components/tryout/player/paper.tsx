import { type ComponentProps, createContext, type ReactNode, use } from "react";
import { useTranslations } from "use-intl";
import {
  type BreadcrumbHeaderItem,
  BreadcrumbHeaderPath,
} from "@/components/shared/breadcrumb/header";
import { PageHeader } from "@/components/shared/page/header";
import type { TryoutSectionPart } from "@/components/tryout/section/model";
import { HOME_TARGET } from "@/lib/routing/target";

/** The paper the try-out player shows, which its page provides (`TryoutPaperProvider`). */
const PaperContext = createContext<Omit<
  ComponentProps<typeof TryoutPaperProvider>,
  "children"
> | null>(null);

/**
 * Gives the try-out player the paper on screen: the way to it, its name, the set's sections and the one on screen,
 * and whether a running simulation holds the learner in it. The section page and the set's entry provide it, so the
 * player's header and its pane read the same paper wherever it runs.
 */
export function TryoutPaperProvider({
  attemptId,
  children,
  current,
  locked,
  parts,
  path,
  title,
}: {
  /** The attempt the page is bound to, which a chosen section keeps. */
  attemptId?: string | undefined;
  children: ReactNode;
  /** The key of the section on screen. */
  current: string;
  /** Whether a running simulation holds the learner in the section on screen. */
  locked: boolean;
  /** The set's sections; a set of one section has none to pick. */
  parts: readonly TryoutSectionPart[];
  /** The way to the paper, its last item the paper itself. */
  path: readonly BreadcrumbHeaderItem[];
  title: string;
}) {
  return (
    <PaperContext value={{ attemptId, current, locked, parts, path, title }}>
      {children}
    </PaperContext>
  );
}

/** The paper on screen, or none outside a page that provides it. */
export function useTryoutPaper() {
  return use(PaperContext);
}

/**
 * The try-out player's header, the page's own (`PageHeader`): the way to the paper from Nakafa's home at the start,
 * then what the player adds, the timer in the centre below the large breakpoint and the end of the row
 * (`PlayerHeaderEnd`). The paper's name is the page's heading for a screen reader, as the path's last item shows it.
 */
export function TryoutPlayerHeader({ children }: { children: ReactNode }) {
  const tCommon = useTranslations("Common");
  const paper = useTryoutPaper();

  return (
    <PageHeader title={paper?.title ?? ""}>
      <BreadcrumbHeaderPath
        home={HOME_TARGET}
        homeLabel={tCommon("home")}
        items={paper?.path ?? []}
      />
      {children}
    </PageHeader>
  );
}
