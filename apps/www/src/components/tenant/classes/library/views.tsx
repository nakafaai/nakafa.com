import {
  Delete02Icon,
  FolderLibraryIcon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tabs,
  TabsList,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { Array as Arr, Schema } from "effect";
import { useTranslations } from "use-intl";

/** What the library shows: the folder of the page, what the reader starred, or the trash. */
const LibraryMode = Schema.Literals(["files", "starred", "trash"]);

/** One view of the library. */
export type LibraryMode = typeof LibraryMode.Type;

/** The icon of each view. */
const VIEW_ICONS = {
  files: FolderLibraryIcon,
  starred: StarIcon,
  trash: Delete02Icon,
};

/** The tabs that switch the library between its views; the trash shows only to whoever manages the library. */
export function LibraryViews({
  manages,
  setView,
  view,
}: {
  manages: boolean;
  setView: (view: LibraryMode) => void;
  view: LibraryMode;
}) {
  const t = useTranslations("Classroom");
  const views = manages
    ? LibraryMode.literals
    : Arr.filter(LibraryMode.literals, (shown) => shown !== "trash");

  return (
    <Tabs
      onValueChange={(next) => {
        if (Schema.is(LibraryMode)(next)) {
          setView(next);
        }
      }}
      value={view}
    >
      <TabsList>
        {Arr.map(views, (shown) => (
          <TabsTab key={shown} value={shown}>
            <HugeIcons aria-hidden="true" icon={VIEW_ICONS[shown]} />
            {t(`library-view-${shown}`)}
          </TabsTab>
        ))}
      </TabsList>
    </Tabs>
  );
}
