import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import { File02Icon, Target02Icon } from "@hugeicons/core-free-icons";
import insight from "@repo/backend/confect/_generated/refs/insight";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty } from "@/components/shared/table/frame";
import { TableTitle } from "@/components/shared/table/title";
import { useTenant } from "@/components/tenant/context";
import { percentOf } from "@/components/tenant/insight/rows";
import { Link } from "@/lib/routing/link";

/** The columns of a student's own standing. */
const skillColumns =
  tableColumns<Ref.Returns<typeof insight.reads.mine>[number]>();

/** A student's own standing in each competency, without a chance, with their exams one press from every row. */
export function OwnMastery() {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const mine = useQuery(insight.reads.mine, isSettled ? { slug } : "skip");

  if (QueryResult.isFailure(mine)) {
    throw mine.error;
  }
  return (
    <DataTable
      columns={[
        skillColumns.text((skill) => skill.competency, {
          cell: (info) => (
            <TableTitle icon={Target02Icon}>
              <span dir="auto">{info.getValue()}</span>
            </TableTitle>
          ),
          header: t("competency"),
          id: "competency",
        }),
        skillColumns.number((skill) => percentOf(skill.rating), {
          header: t("mastery"),
          id: "mastery",
        }),
        skillColumns.number((skill) => skill.earned, {
          cell: (info) =>
            t("evidence-points", {
              earned: info.getValue(),
              possible: info.row.original.possible,
            }),
          header: t("evidence"),
          id: "evidence",
        }),
        skillColumns.number((skill) => skill.observations, {
          header: t("observations"),
          id: "observations",
        }),
        skillColumns.menu(() => <OwnExamsLink />),
      ]}
      data={QueryResult.isSuccess(mine) ? mine.value : []}
      empty={
        <TableEmpty
          act="waving"
          action={
            <Link
              className={buttonVariants()}
              params={{ slug }}
              to="/school/$slug/exams"
            >
              {t("exams-action")}
            </Link>
          }
          description={t("empty-description")}
          title={t("empty")}
        />
      }
      loading={!QueryResult.isSuccess(mine)}
      rowId={(skill) => skill.competency}
    />
  );
}

/** The action of a row of a student's standing: the exams its points came from. */
function OwnExamsLink() {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();

  return (
    <div className="flex justify-end">
      <Button
        render={
          <Link params={{ slug }} to="/school/$slug/exams">
            <HugeIcons icon={File02Icon} />
            {t("exams-action")}
          </Link>
        }
        size="sm"
        variant="outline"
      />
    </div>
  );
}
