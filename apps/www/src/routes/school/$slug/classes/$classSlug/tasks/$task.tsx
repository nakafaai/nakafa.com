import { TaskAddress } from "@repo/backend/confect/classroom/tasks/schema";
import { createFileRoute } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import type { ReactElement } from "react";
import { ClassShell } from "@/components/tenant/classes/shell";
import { guardSchoolPage } from "@/lib/tenant/guard";
import { readClassAddress } from "@/lib/tenant/params";

/**
 * One task of a class, such as `/classes/fisika-x-1/tasks/latihan-gerak-lurus` (ADR 0026). An
 * address that names no class or no task of it is not found for every viewer.
 */
export const Route = createFileRoute(
  "/school/$slug/classes/$classSlug/tasks/$task"
)({
  ...guardSchoolPage({
    reads: (params: { readonly classSlug: string; readonly task: string }) =>
      Option.all({
        classAddress: readClassAddress(params.classSlug),
        task: Schema.decodeOption(TaskAddress)(params.task),
      }),
  }),
  component: SchoolClassTaskPage,
});

function SchoolClassTaskPage(): ReactElement {
  const { classAddress, slug, task } = Route.useRouteContext();
  return (
    <ClassShell
      classSlug={classAddress}
      slug={slug}
      view={{ _tag: "task", task }}
    />
  );
}
