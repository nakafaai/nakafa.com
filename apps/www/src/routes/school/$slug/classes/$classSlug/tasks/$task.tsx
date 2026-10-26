import { TaskAddress } from "@repo/backend/confect/classroom/tasks/task";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option, Schema } from "effect";
import type { ReactElement } from "react";
import { CHANNEL_PAGE_SIZE } from "@/components/tenant/classes/channels";
import { ClassShell } from "@/components/tenant/classes/shell";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readClassForumFn } from "@/lib/tenant/classes.functions";
import { readClassAddress } from "@/lib/tenant/params";

/**
 * One task of a class, such as `/classes/fisika-x-1/tasks/latihan-gerak-lurus` (ADR 0026). An
 * address that names no class or no task of it is not found for every viewer.
 */
export const Route = createFileRoute(
  "/school/$slug/classes/$classSlug/tasks/$task"
)({
  beforeLoad: ({ params }) => {
    const classAddress = readClassAddress(params.classSlug);
    const task = Schema.decodeOption(TaskAddress)(params.task);
    if (Option.isNone(classAddress) || Option.isNone(task)) {
      throw notFound();
    }
    return { classAddress: classAddress.value, task: task.value };
  },
  loader: ({ context }) => {
    if (context.school._tag !== "Member") {
      return;
    }
    return readClassForumFn({
      data: {
        classSlug: context.classAddress,
        numItems: CHANNEL_PAGE_SIZE,
        slug: context.slug,
      },
    });
  },
  component: SchoolClassTaskPage,
  notFoundComponent: SchoolPageNotFound,
});

function SchoolClassTaskPage(): ReactElement {
  const { classAddress, slug, task } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  return (
    <ClassShell
      classSlug={classAddress}
      preload={preload}
      slug={slug}
      view={{ _tag: "task", task }}
    />
  );
}
