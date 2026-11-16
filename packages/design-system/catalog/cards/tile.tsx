import {
  BookOpen01Icon,
  Calculator01Icon,
  Globe02Icon,
  Medal01Icon,
} from "@hugeicons/core-free-icons";
import { Tile, TileIcon } from "@repo/design-system/components/ui/tile";

// The shifts are what getTileShifts gives these four seeds, in this order, so neighbors keep apart.
export const card = {
  name: "Tile",
  group: "Identity",
  height: 210,
  source: "components/ui/tile",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="grid gap-6 p-6">
      <div className="flex flex-wrap items-center gap-4">
        <Tile seed="lesson:algebra-linear" shift={0}>
          <TileIcon icon={BookOpen01Icon} />
        </Tile>
        <Tile seed="lesson:physics-motion" shift={0}>
          <TileIcon icon={Calculator01Icon} />
        </Tile>
        <Tile seed="lesson:biology-cell" shift={18}>
          <TileIcon icon={Globe02Icon} />
        </Tile>
        <Tile seed="lesson:history-indonesia" shift={0}>
          <TileIcon icon={Medal01Icon} />
        </Tile>
      </div>
      <Tile className="h-24" seed="tryout:snbt-2026" variant="card">
        <TileIcon icon={Calculator01Icon} />
      </Tile>
    </div>
  );
}
