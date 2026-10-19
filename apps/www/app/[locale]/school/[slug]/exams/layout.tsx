import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { canOpenExams, canOpenRooms } from "@/components/tenant/exams/access";
import { TenantSection } from "@/components/tenant/section";
import { readViewer } from "@/lib/tenant/read";

/**
 * The layout of the school exams. Only a viewer who may view exams, or the rooms of an exam, in the
 * school or in one of its units reads these pages: a signed-out viewer, a viewer who is not a
 * member, and a viewer with neither action, such as a student, get not found. The exam list and
 * the exam editor check `canOpenExams` on their own pages, so a viewer who only reads rooms gets
 * neither. The school shell mounts the client providers that the exam pages need.
 */
export default async function SchoolExamsLayout({
  children,
  params,
}: LayoutProps<"/[locale]/school/[slug]/exams">) {
  const { slug: slugParam } = await params;
  if (!Schema.is(TenantSlug)(slugParam)) {
    notFound();
  }
  const viewer = await readViewer(slugParam);
  if (
    viewer._tag !== "member" ||
    !(canOpenExams(viewer.viewer) || canOpenRooms(viewer.viewer))
  ) {
    notFound();
  }

  return <TenantSection section="exams">{children}</TenantSection>;
}
