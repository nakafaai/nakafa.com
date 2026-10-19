import { HttpClient } from "@confect/js";
import { Id } from "@repo/backend/confect/_generated/id";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Option, Schema } from "effect";
import { notFound } from "next/navigation";
import { canOpenExams } from "@/components/tenant/exams/access";
import { ExamEditor } from "@/components/tenant/exams/editor";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";

/** A viewer the school does not list gets no viewer, and the editor answers not found. */
const notInSchool = () => Effect.succeedNone;

/**
 * The editor of one exam of the school. The editor is for the exam editors, as the exam list is,
 * so a viewer who reads the rooms of an exam alone gets not found here. The exam's own queries
 * still decide what the viewer may read and change in it.
 */
export default async function SchoolExamEditPage({
  params,
}: PageProps<"/[locale]/school/[slug]/exams/[exam]/edit">) {
  const { exam, slug } = await params;
  if (!(Schema.is(TenantSlug)(slug) && Schema.is(Id("exams"))(exam))) {
    notFound();
  }
  const token = await getToken();
  if (token === undefined) {
    notFound();
  }
  const viewer = await Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) => client.query(tenancy.viewer.get, { slug })),
      Effect.asSome,
      Effect.catchTags({ AccessDenied: notInSchool, NotMember: notInSchool }),
      Effect.provide(httpLayer({ auth: token }))
    )
  );
  if (Option.isNone(viewer) || !canOpenExams(viewer.value)) {
    notFound();
  }
  return <ExamEditor examId={exam} slug={slug} />;
}
