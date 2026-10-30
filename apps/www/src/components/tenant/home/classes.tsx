import type { Ref } from "@confect/core";
import type classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Dashboard } from "@repo/design-system/components/ui/dashboard";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import type { CellSpan } from "@/components/tenant/home/cells";
import { TargetLink } from "@/lib/routing/link";
import { schoolClassTarget } from "@/lib/routing/school/target";

/** One class of the viewer, as the classes read returns it. */
type Klass = Ref.Returns<typeof classroom.classes.mine>[number];

/**
 * The classes the viewer teaches or attends, in the order the server gives, each a row that opens the class: its
 * announcements, its forum, its library and its tasks.
 */
export function ClassesCell({
  classes,
  span,
}: {
  classes: readonly Klass[];
  span: CellSpan;
}) {
  const t = useTranslations("School");

  return (
    <Dashboard.Cell narrow={span.narrow} wide={span.wide}>
      <Dashboard.CellHeader title={t("classes")} />
      <Dashboard.List>
        {Arr.map(classes, (klass) => (
          <ClassRow key={klass.id} klass={klass} />
        ))}
      </Dashboard.List>
    </Dashboard.Cell>
  );
}

/** One class, as a row that opens the class's page. */
function ClassRow({ klass }: { klass: Klass }) {
  const { slug } = useTenant();

  return (
    <Dashboard.Row
      render={
        <TargetLink
          dir="auto"
          target={schoolClassTarget(slug, klass.slug)}
          title={klass.name}
        />
      }
      title={klass.name}
    />
  );
}
