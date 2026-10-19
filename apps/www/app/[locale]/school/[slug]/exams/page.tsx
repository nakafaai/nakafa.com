import { HttpClient } from "@confect/js";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Option, Schema } from "effect";
import { notFound } from "next/navigation";
import { canOpenExams } from "@/components/tenant/exams/access";
import { ExamList } from "@/components/tenant/exams/list";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";

/** A viewer the school does not list gets no viewer, and the list answers not found. */
const notInSchool = () => Effect.succeedNone;

/**
 * The exams of the school, newest first. The layout admits the viewers of the rooms too, so this
 * page reads the viewer and answers not found for one who may not view exams: the exam list is
 * for the editors of the school only.
 */
export default async function SchoolExamsPage({
  params,
}: PageProps<"/[locale]/school/[slug]/exams">) {
  const { slug } = await params;
  if (!Schema.is(TenantSlug)(slug)) {
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
  return <ExamList slug={slug} />;
}
