import type { Ref } from "@confect/core";
import { MortarboardIcon } from "@hugeicons/core-free-icons";
import type records from "@repo/backend/confect/_generated/refs/records";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { TableEmpty } from "@/components/shared/table/frame";
import { useTenant } from "@/components/tenant/context";
import { Link } from "@/lib/routing/link";

/** The page of a class group that does not graduate, as the graduation page reads it. */
type ElsewherePage = Extract<
  Ref.Returns<typeof records.graduations.get>,
  { readonly _tag: "NotGraduating" }
>;

/**
 * Why a class group does not graduate: only its unit's last grade does, and it stands in another
 * grade, or its unit has no graduation at all. The one way on is the graduating class groups.
 */
export function GraduationElsewhere({ page }: { page: ElsewherePage }) {
  const t = useTranslations("SchoolGraduation");
  const { slug } = useTenant();
  const { cohort, unit } = page;

  return (
    <TableEmpty
      act="pointing"
      action={
        <Link
          className={buttonVariants({ variant: "outline" })}
          params={{ slug }}
          to="/school/$slug/graduation"
        >
          <HugeIcons icon={MortarboardIcon} />
          {t("elsewhere-action")}
        </Link>
      }
      description={
        unit.last === null
          ? t("elsewhere-none", { unit: unit.name })
          : t("elsewhere-description", {
              cohort: cohort.name,
              grade: cohort.grade,
              last: unit.last,
              unit: unit.name,
            })
      }
      title={t("elsewhere-title", { cohort: cohort.name })}
    />
  );
}
