import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { type ComponentProps, createContext, type ReactNode, use } from "react";
import type { PlayerMode } from "@/components/player/mode";
import type {
  TryoutSectionInitialState,
  TryoutSectionPage,
  TryoutSectionPart,
  TryoutSectionRoute,
} from "@/components/tryout/section/model";

/** The page a section client draws, which `TryoutSectionPageProvider` gives every part of it. */
const PageContext = createContext<Omit<
  ComponentProps<typeof TryoutSectionPageProvider>,
  "children"
> | null>(null);

/**
 * Gives the parts of one section page what the page draws: the attempt it is bound to, its section page, its set's
 * sections, whether the learner read is pending, its route, and the path of its set.
 */
export function TryoutSectionPageProvider({
  binding,
  children,
  page,
  parts,
  pending,
  route,
  setPath,
}: {
  binding: {
    attemptId: Id<"tryoutAttempts">;
    initialState: TryoutSectionInitialState;
    /** The player view resolved in the browser from the address and the saved view. */
    mode: PlayerMode;
    startPath: string | null;
  } | null;
  children: ReactNode;
  page: TryoutSectionPage;
  /** The set's sections, which the player's pane picks between. */
  parts: readonly TryoutSectionPart[];
  /** The learner's attempt is still being read, so the action waits for it and takes no press. */
  pending: boolean;
  route: TryoutSectionRoute;
  setPath: string;
}) {
  return (
    <PageContext value={{ binding, page, parts, pending, route, setPath }}>
      {children}
    </PageContext>
  );
}

/** Reads the page of the surrounding section client. */
export function useTryoutSectionPage() {
  const value = use(PageContext);
  if (value === null) {
    throw new Error(
      "useTryoutSectionPage must be used within TryoutSectionPageProvider"
    );
  }
  return value;
}
