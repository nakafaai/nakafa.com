import type { ReactNode } from "react";
import { PageActions } from "@/components/shared/page/header";

/**
 * The end of a player's header, the page's own header (`PageHeader`), the same for a try-out, a School sitting and a
 * teacher's try: the paper's history, when it has one, then the one primary action. The header's start is the paper's
 * path, its last item the paper itself, and its centre the time left below the large breakpoint (`PlayerTimer`). The
 * view and the keys live in the pane's footer (`PlayerTools`), so the row never holds more than two buttons.
 */
export function PlayerHeaderEnd({ children }: { children: ReactNode }) {
  return <PageActions>{children}</PageActions>;
}
