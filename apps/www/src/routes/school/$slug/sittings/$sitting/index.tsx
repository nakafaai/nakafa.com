import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import type { ReactElement } from "react";
import { SittingModeProvider } from "@/components/exams/sitting/mode";
import { StudentSitting } from "@/components/exams/sitting/student";
import { readPlayerModeParam } from "@/components/player/mode";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readStudentSittingFn } from "@/lib/tenant/exams.functions";
import { readSittingId } from "@/lib/tenant/params";

/** The address of a student's sitting: the view the learner asks for, which wins over the saved view. */
const StudentSittingSearch = Schema.Struct({
  view: Schema.optionalKey(Schema.String),
});

/**
 * A student's screen of one sitting. The sitting itself decides whether the student may enter it, and a
 * failed address to the sitting is not found for every viewer.
 */
export const Route = createFileRoute("/school/$slug/sittings/$sitting/")({
  validateSearch: Schema.toStandardSchemaV1(StudentSittingSearch),
  loaderDeps: ({ search }) => search,
  beforeLoad: ({ params }) => {
    const sittingId = readSittingId(params.sitting);
    if (Option.isNone(sittingId)) {
      throw notFound();
    }
    return { sittingId: sittingId.value };
  },
  loader: ({ context, deps }) => {
    if (context.school._tag !== "Member") {
      return;
    }
    return readStudentSittingFn({
      data: {
        sittingId: context.sittingId,
        slug: context.slug,
        view: readPlayerModeParam(deps),
      },
    });
  },
  component: StudentSittingPage,
  notFoundComponent: SchoolPageNotFound,
});

function StudentSittingPage(): ReactElement | null {
  const { sittingId, slug } = Route.useRouteContext();
  const loaded = Route.useLoaderData();
  return (
    <SittingModeProvider mode={loaded?.mode ?? "list"}>
      <StudentSitting
        preload={loaded?.preload}
        sittingId={sittingId}
        slug={slug}
      />
    </SittingModeProvider>
  );
}
