import { useNavigate } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import { PlayerParts } from "@/components/player/parts";
import { getTryoutSubjectIcons } from "@/components/tryout/catalog/icons";
import { useTryoutPaper } from "@/components/tryout/player/paper";
import { getTryoutPageTarget } from "@/components/tryout/route/path";

/**
 * The sections of the try-out set on screen at the top of the player's pane, each with the icon the set's page shows
 * for it. A running simulation holds the learner in its section; anywhere else a section opens its own page, in the
 * attempt the page is bound to. A page with no paper, or a set of one section, shows none.
 */
export function TryoutPlayerParts() {
  const navigate = useNavigate();
  const paper = useTryoutPaper();

  if (paper === null) {
    return null;
  }
  return (
    <PlayerParts
      current={paper.current}
      iconOf={(part) => Arr.headNonEmpty(getTryoutSubjectIcons(part.key))}
      locked={paper.locked}
      onChoose={(part) =>
        Option.map(
          getTryoutPageTarget({
            attemptId: paper.attemptId,
            publicPath: part.publicPath,
          }),
          (target) => navigate(target)
        )
      }
      parts={paper.parts}
    />
  );
}
