import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { StudentSitting } from "@/components/exams/sitting/student";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readStudentSittingFn } from "@/lib/tenant/exams.functions";
import { readSittingId } from "@/lib/tenant/params";

/**
 * A student's screen of one sitting. The sitting itself decides whether the student may enter it, and a
 * failed address to the sitting is not found for every viewer.
 */
export const Route = createFileRoute("/school/$slug/sittings/$sitting/")({
  beforeLoad: ({ params }) => {
    const sittingId = readSittingId(params.sitting);
    if (Option.isNone(sittingId)) {
      throw notFound();
    }
    return { sittingId: sittingId.value };
  },
  loader: ({ context }) => {
    if (context.school._tag !== "Member") {
      return;
    }
    return readStudentSittingFn({
      data: { sittingId: context.sittingId, slug: context.slug },
    });
  },
  component: StudentSittingPage,
  notFoundComponent: SchoolPageNotFound,
});

function StudentSittingPage(): ReactElement | null {
  const { sittingId, slug } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  return <StudentSitting preload={preload} sittingId={sittingId} slug={slug} />;
}
