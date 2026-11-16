import {
  Add01Icon,
  Alert02Icon,
  ArrowRight02Icon,
  BookOpen02Icon,
  Calendar03Icon,
  Copy01Icon,
  Globe02Icon,
  InformationCircleIcon,
  Link05Icon,
  MessageMultiple02Icon,
  Search02Icon,
  StudentIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Record as Rec } from "effect";

const icons = {
  Search02Icon,
  BookOpen02Icon,
  StudentIcon,
  MessageMultiple02Icon,
  Calendar03Icon,
  Globe02Icon,
  Link05Icon,
  Copy01Icon,
  Add01Icon,
  Tick01Icon,
  InformationCircleIcon,
  Alert02Icon,
  ArrowRight02Icon,
};

export const card = {
  name: "HugeIcons",
  group: "Content",
  height: 150,
  source: "huge-icons",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap gap-4">
        {Arr.map(Rec.toEntries(icons), ([name, icon]) => (
          <HugeIcons
            aria-label={name}
            className="size-4"
            icon={icon}
            key={name}
          />
        ))}
      </div>
    </div>
  );
}
