import { HttpClient } from "@confect/js";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Option, Schema } from "effect";
import { notFound } from "next/navigation";
import { AppProviders } from "@/components/providers/app";
import { canOpenExams } from "@/components/tenant/exams/access";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";

/** A viewer the school does not list gets no school, and the exam pages answer not found. */
const notInSchool = () => Effect.succeedNone;

/**
 * The layout of the school exams. Only a viewer who holds a grant whose role is not Student
 * reads these pages: a signed-out viewer, a viewer who is not a member, and a student get not
 * found. The exam pages are client components, so this layout mounts the client providers of
 * the app layout, as the school settings layout does.
 */
export default async function SchoolExamsLayout({
  children,
  params,
}: LayoutProps<"/[locale]/school/[slug]/exams">) {
  const { slug: slugParam } = await params;
  if (!Schema.is(TenantSlug)(slugParam)) {
    notFound();
  }
  const slug = slugParam;
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
  if (Option.isNone(viewer) || !canOpenExams(viewer.value.grants)) {
    notFound();
  }

  return <AppProviders pageNavigation={null}>{children}</AppProviders>;
}
