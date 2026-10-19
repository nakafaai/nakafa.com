"use client";

import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr } from "effect";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useConvexAuth } from "@/components/providers/convex";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { useTenant } from "@/components/tenant/context";
import { schoolDateTimeText } from "@/components/tenant/settings/clock";
import { orderSittings } from "@/components/tenant/sittings.client";

/** One sitting of the student's list, as the server returns it. */
type Sitting = typeof SittingView.Type;

/**
 * The sittings that a student may take part in, on the school home: the open ones first, then the
 * scheduled ones, each linking to its screen. Only a student holds sittings, so the list stays out
 * of the home of every other role.
 */
export function StudentSittings() {
  const tenant = useTenant();
  if (tenant.role !== "student") {
    return null;
  }
  return <SittingList slug={tenant.slug} />;
}

/**
 * The student's sittings in a data table, read once Convex has settled the session. Until the
 * answer comes the list shows nothing, and a student with no sitting open sees Nina and why.
 */
function SittingList({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("School");
  const te = useTranslations("Exams");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const listed = useQuery(exams.sittings.mine, isSettled ? { slug } : "skip");

  if (QueryResult.isFailure(listed)) {
    throw listed.error;
  }
  if (!QueryResult.isSuccess(listed)) {
    return null;
  }
  const rows = orderSittings(listed.value);

  return (
    <div className="mt-6 grid gap-4">
      <h2 className="font-medium text-base">{t("sittings-title")}</h2>
      {Arr.isReadonlyArrayEmpty(rows) ? (
        <TableEmpty
          act="relaxed"
          description={t("sittings-empty-description")}
          title={t("sittings-empty")}
        />
      ) : (
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("sitting-exam")}</TableHead>
                <TableHead>{te("room")}</TableHead>
                <TableHead>{te("rooms-opens")}</TableHead>
                <TableHead>{te("rooms-state")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Arr.map(rows, (sitting) => (
                <StudentSittingRow key={sitting.id} sitting={sitting} />
              ))}
            </TableBody>
          </Table>
        </TableFrame>
      )}
    </div>
  );
}

/**
 * One sitting of the list: its exam, its room, which links to the student's screen, its opening
 * in the time zone of its unit, and its state.
 */
function StudentSittingRow({ sitting }: { sitting: Sitting }) {
  const te = useTranslations("Exams");
  const locale = useLocale();

  return (
    <TableRow>
      <TableCell>{sitting.examTitle}</TableCell>
      <TableCell className="font-medium">
        <Link
          className="underline-offset-4 hover:underline"
          href={`/sittings/${sitting.id}`}
        >
          {sitting.room}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {schoolDateTimeText({
          at: sitting.opensAt,
          locale,
          timeZone: sitting.timeZone,
        })}
      </TableCell>
      <TableCell>{te(`room-state-${sitting.state}`)}</TableCell>
    </TableRow>
  );
}
