import type { Ref } from "@confect/core";
import { QueryResult } from "@confect/react";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { useRouter } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { type ReactNode, useEffect } from "react";
import { useViewerQuery } from "@/components/tenant/context";
import { canOpenExams, canOpenRooms } from "@/components/tenant/exams/access";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { isLostAccess } from "@/components/tenant/refusal";

/** The viewer's view of the school, as the school layout reads it. */
type Viewer = Ref.Returns<typeof tenancy.viewer.get>;

/** The school sections whose layouts check the viewer's grant on the server. */
type TenantSectionName = "exams" | "settings";

/** The grant that each section's layout checks, so a change made while the page is open answers the same way. */
const SECTION_GRANTS: Readonly<
  Record<TenantSectionName, (viewer: Viewer) => boolean>
> = {
  exams: (viewer) => canOpenExams(viewer) || canOpenRooms(viewer),
  settings: (viewer) => Arr.contains(viewer.can, "tenant.manage"),
};

/**
 * Answers a change made while a section is open the way a reload of the same address answers it.
 * The section's layout refuses a viewer without the grant with the school's not-found page, so a
 * live read that loses the grant shows that page too. A viewer who is no longer a member is the
 * school's own answer, so the gate hands that failure to the school's boundary. Until the viewer
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
    throw viewer.error;
  }
  if (QueryResult.isSuccess(viewer) && !SECTION_GRANTS[section](viewer.value)) {
    return <TenantSectionLost />;
  }
  return children;
}

/**
 * The section of a viewer who lost its grant while the page was open: the not-found page that a
 * reload answers. The router loads the school's frame again once, so the shell drops the section's
 * link as a reload would.
 */
function TenantSectionLost() {
  const router = useRouter();

  useEffect(() => {
    router.invalidate();
  }, [router]);

  return <SchoolPageNotFound />;
}
