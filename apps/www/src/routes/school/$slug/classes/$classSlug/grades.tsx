import { createFileRoute, notFound } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactElement } from "react";
import { ClassShell } from "@/components/tenant/classes/shell";
import {
  GRADEBOOK_PAGE_SIZE,
  GradebookPreload,
} from "@/components/tenant/grades/sheet";
import { SchoolPageNotFound } from "@/components/tenant/notfound";
import { readClassGradesFn } from "@/lib/tenant/grades.functions";
import { readClassAddress } from "@/lib/tenant/params";

/**
 * The gradebook of one class of the school (ADR 0033, S2), which its subject teachers keep.
 * The loader reads the class, its scheme, and the gradebook's first page, so the page shows
 * whole at once. A failed address to a class is not found for every viewer.
 */
export const Route = createFileRoute("/school/$slug/classes/$classSlug/grades")(
  {
    beforeLoad: ({ params }) => {
      const classAddress = readClassAddress(params.classSlug);
      if (Option.isNone(classAddress)) {
        throw notFound();
      }
      return { classAddress: classAddress.value };
    },
    loader: ({ context }) => {
      if (context.school._tag !== "Member") {
        return;
      }
      return readClassGradesFn({
        data: {
          classSlug: context.classAddress,
          numItems: GRADEBOOK_PAGE_SIZE,
          slug: context.slug,
        },
      });
    },
    component: SchoolClassGradesPage,
    notFoundComponent: SchoolPageNotFound,
  }
);

function SchoolClassGradesPage(): ReactElement {
  const { classAddress, slug } = Route.useRouteContext();
  const preload = Route.useLoaderData();
  return (
    <GradebookPreload value={preload}>
      <ClassShell
        classSlug={classAddress}
        preload={preload}
        slug={slug}
        view={{ _tag: "grades" }}
      />
    </GradebookPreload>
  );
}
