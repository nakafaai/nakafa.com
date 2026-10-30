import { createContext, type ReactNode, use } from "react";

/**
 * Whether the answers below are read-only: a locked attempt's paper, or the proctor's view of a student's
 * screen. A paper that provides no lock takes answers.
 */
const PaperLockContext = createContext(false);

/** Makes the answers below read-only while `locked`. */
export function PaperLockProvider({
  children,
  locked,
}: {
  children: ReactNode;
  locked: boolean;
}) {
  return <PaperLockContext value={locked}>{children}</PaperLockContext>;
}

/** Whether the answers below are read-only. */
export function usePaperLocked() {
  return use(PaperLockContext);
}
