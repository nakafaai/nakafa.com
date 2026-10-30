import type { Ref } from "@confect/core";
import type classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Item, ItemMedia } from "@repo/design-system/components/ui/item";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { withMarks } from "@/components/tenant/classes/marks";
import { useTenant } from "@/components/tenant/context";
import {
  HomeQuiet,
  HomeRowText,
  HomeSection,
} from "@/components/tenant/home/section";
import { TargetLink } from "@/lib/routing/link";
import { schoolClassTarget } from "@/lib/routing/school/target";

/** One class of the viewer, as the classes read returns it. */
type Klass = Ref.Returns<typeof classroom.classes.mine>[number];

/**
 * The classes the viewer teaches or attends, in the order the server gives, each a tile with the animal the sidebar
 * gives it, its name and its subject, which opens the class: its announcements, its forum, its library and its tasks.
 * The tiles fill the row at every width, as many as fit. A student who is in no class yet reads one sentence instead.
 */
export function ClassesSection({ classes }: { classes: readonly Klass[] }) {
  const t = useTranslations("School");

  return (
    <HomeSection title={t("classes")}>
      {Arr.isReadonlyArrayNonEmpty(classes) ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
          {Arr.map(withMarks(classes), (klass) => (
            <ClassTile key={klass.id} klass={klass} />
          ))}
        </ul>
      ) : (
        <HomeQuiet>{t("home-classes-empty")}</HomeQuiet>
      )}
    </HomeSection>
  );
}

/** One class as a tile that opens the class's page. */
function ClassTile({
  klass,
}: {
  klass: ReturnType<typeof withMarks<Klass>>[number];
}) {
  const { slug } = useTenant();

  return (
    <li className="min-w-0">
      <Item
        className="h-full bg-card shadow-xs"
        render={<TargetLink target={schoolClassTarget(slug, klass.slug)} />}
        variant="outline"
      >
        <ItemMedia>
          <PersonAvatar className="size-10" mascot={klass.mascot} />
        </ItemMedia>
        <HomeRowText detail={klass.subject} title={klass.name} />
      </Item>
    </li>
  );
}
