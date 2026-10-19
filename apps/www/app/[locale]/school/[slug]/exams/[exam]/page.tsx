import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { ExamRooms } from "@/components/tenant/exams/rooms";

/**
 * The rooms of one exam of the school: each sitting of the exam, with its state and a link to its
 * proctor dashboard. An address that names no exam or school answers not found. The exam's query
 * decides whether the viewer may read its rooms.
 */
export default async function SchoolExamRoomsPage({
  params,
}: PageProps<"/[locale]/school/[slug]/exams/[exam]">) {
  const { exam, slug } = await params;
  if (!(Schema.is(TenantSlug)(slug) && Schema.is(Id("exams"))(exam))) {
    notFound();
  }
  return <ExamRooms examId={exam} slug={slug} />;
}
