import { createFileRoute } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import type { ReactElement } from "react";
import { SittingModeProvider } from "@/components/exams/sitting/mode";
import { SittingRecovery } from "@/components/exams/sitting/recovery";
import { StudentSitting } from "@/components/exams/sitting/student";
import {
  readBrowserPlayerMode,
  readPlayerModeParam,
} from "@/components/player/mode";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { readSittingId } from "@/lib/tenant/params";

/** The address of a student's sitting: the view the learner asks for, which wins over the saved view. */
const StudentSittingSearch = Schema.Struct({
  view: Schema.optionalKey(Schema.String),
});

/**
 * The sitting that the address names. It is built outside the route options: there
 * `loaderDeps` defers TypeScript's inference of the options, and the guard's call,
 * typed by the `beforeLoad` it fills, would lose the `sittingId` it adds to the context.
 */
const guardSitting = guardSchoolPage({
  reads: (params: { readonly sitting: string }) =>
    Option.all({ sittingId: readSittingId(params.sitting) }),
});

/**
 * A student's screen of one sitting. The sitting itself decides whether the student may enter it, and a
 * failed address to the sitting is not found for every viewer.
 */
export const Route = createFileRoute("/school/$slug/sittings/$sitting/")({
  validateSearch: Schema.toStandardSchemaV1(StudentSittingSearch),
  loaderDeps: ({ search }) => search,
  beforeLoad: guardSitting,
  notFoundComponent: SchoolPageNotFound,
  // The view comes from the address, then the view the learner saved; the sitting reads live.
  loader: ({ deps }) => readBrowserPlayerMode(readPlayerModeParam(deps)),
  component: StudentSittingPage,
});

function StudentSittingPage(): ReactElement | null {
  const { sittingId, slug } = Route.useRouteContext();
  const mode = Route.useLoaderData();
  return (
    <SittingModeProvider mode={mode}>
      <SittingRecovery>
        <StudentSitting sittingId={sittingId} slug={slug} />
      </SittingRecovery>
    </SittingModeProvider>
  );
}
