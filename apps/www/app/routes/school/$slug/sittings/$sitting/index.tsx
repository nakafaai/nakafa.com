import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { StudentSitting } from "@/components/exams/sitting/student";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readSittingId } from "@/lib/tenant/params";

/** A student's screen of one sitting. The sitting itself decides whether the student may enter it. */
export const Route = createFileRoute("/school/$slug/sittings/$sitting/")({
  beforeLoad: ({ context, params }) => {
    const sittingId = readSittingId(params.sitting);
    if (context.school._tag === "Member" && Option.isNone(sittingId)) {
      throw notFound();
    }
    return { sittingId };
  },
  component: StudentSittingPage,
  notFoundComponent: SchoolPageNotFound,
});

function StudentSittingPage(): ReactElement {
  const { sittingId, slug } = Route.useRouteContext();
  return Option.match(sittingId, {
    onNone: () => <></>,
    onSome: (id) => <StudentSitting sittingId={id} slug={slug} />,
  });
}
