import type { Ref } from "@confect/core";
import { QueryResult } from "@confect/react";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useViewerQuery } from "@/components/tenant/context";
import { canOpenExams, canOpenRooms } from "@/components/tenant/exams/access";
import { isLostAccess } from "@/components/tenant/refusal";
import { TenantRefused } from "@/components/tenant/refused";

/** The viewer's view of the school, as the school layout reads it. */
type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

/** The school sections whose layouts check the viewer's grant before the page commits. */
type TenantSectionName = "exams" | "settings";

/** The grant that each section's layout checks, so a change made while the page is open answers the same way. */
const SECTION_GRANTS: Readonly<
  Record<TenantSectionName, (viewer: Viewer) => boolean>
> = {
  exams: (viewer) => canOpenExams(viewer) || canOpenRooms(viewer),
  settings: (viewer) => Arr.contains(viewer.can, "tenant.manage"),
};

/**
 * Keeps a school section on the refused page once a live read of the viewer no longer grants it. The
 * section's layout refuses a viewer without the grant when the page is requested; this gate answers a
 * change made while the page is open, such as a removed role or a removed membership. Until the viewer
 * answers, the section shows, so the first draw never waits for the viewer.
 */
export function TenantSection({
  children,
  section,
}: {
  children: ReactNode;
  section: TenantSectionName;
}) {
  const viewer = useViewerQuery();

  if (QueryResult.isFailure(viewer) && isLostAccess(viewer.error)) {
    return <TenantRefused />;
  }
  if (QueryResult.isSuccess(viewer) && !SECTION_GRANTS[section](viewer.value)) {
    return <TenantRefused />;
  }
  return children;
}
