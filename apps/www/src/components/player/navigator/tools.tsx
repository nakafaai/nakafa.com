import type { ReactNode } from "react";
import { PlayerAccess } from "@/components/player/access";
import { PlayerViewSwitch } from "@/components/player/view";
import { PaneFooter } from "@/components/shared/page/pane";

/**
 * The footer of the player's pane, in its side pane and in its phone sheet alike: the accessibility info at the
 * start, the view of the questions, then what the paper adds, such as a result's one action.
 */
export function PlayerTools({ children }: { children?: ReactNode }) {
  return (
    <PaneFooter>
      <PlayerAccess />
      <PlayerViewSwitch />
      {children}
    </PaneFooter>
  );
}
