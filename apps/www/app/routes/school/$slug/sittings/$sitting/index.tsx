import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { StudentSitting } from "@/components/exams/sitting/student";
import { readSittingId } from "@/lib/tenant/params";

/** A student's screen of one sitting. The sitting itself decides whether the student may enter it. */
export const Route = createFileRoute("/school/$slug/sittings/$sitting/")({
  beforeLoad: ({ params }) => {
    const sittingIdOption = readSittingId(params.sitting);
    if (Option.isNone(sittingIdOption)) {
      throw notFound();
    }
    return { sittingId: sittingIdOption.value };
  },
  component: StudentSittingPage,
});

function StudentSittingPage(): ReactElement {
  const { sittingId, slug } = Route.useRouteContext();
  return <StudentSitting sittingId={sittingId} slug={slug} />;
}
