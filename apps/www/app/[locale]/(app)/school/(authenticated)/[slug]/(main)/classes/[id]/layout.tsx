import { captureServerException } from "@repo/analytics/posthog/server";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { fetchQuery } from "convex/nextjs";
import { use } from "react";
import { SchoolClassesForumPostSheet } from "@/components/school/classes/forum/post-sheet";
import { SchoolClassesHeaderInfo } from "@/components/school/classes/info";
import { SchoolClassesJoinForm } from "@/components/school/classes/join-form";
import { SchoolClassesTabs } from "@/components/school/classes/tabs";
import { SchoolNotFound } from "@/components/school/not-found";
import { getToken } from "@/lib/auth/server";
import { ClassContextProvider } from "@/lib/context/use-class";
import { ForumContextProvider } from "@/lib/context/use-forum";

/** Bind the resolved class route snapshot to the class subtree. */
export default function Layout(
  props: LayoutProps<"/[locale]/school/[slug]/classes/[id]">
) {
  const { children, params } = props;
  const { id } = use(params);

  const classId = id as Id<"schoolClasses">;

  return <ClassRouteBoundary classId={classId}>{children}</ClassRouteBoundary>;
}

/**
 * Resolve the class route snapshot on the server so the client subtree only
 * consumes stable class state.
 */
async function ClassRouteBoundary({
  children,
  classId,
}: {
  children: React.ReactNode;
  classId: Id<"schoolClasses">;
}) {
  const token = await getToken();

  if (!token) {
    return <SchoolNotFound />;
  }

  try {
    const value = await fetchQuery(
      api.classes.queries.getClassRoute,
      { classId },
      { token }
    );

    if (value.kind === "joinRequired") {
      return (
        <SchoolClassesJoinForm
          classId={value.class._id}
          visibility={value.class.visibility}
        />
      );
    }

    return (
      <ErrorBoundary fallback={<SchoolNotFound />}>
        <ClassContextProvider value={value}>
          <SchoolClassesHeaderInfo />
          <SchoolClassesTabs />

          <ForumContextProvider key={classId}>
            <SchoolClassesForumPostSheet />
            {children}
          </ForumContextProvider>
        </ClassContextProvider>
      </ErrorBoundary>
    );
  } catch (error) {
    await captureServerException(error, undefined, {
      classId,
      source: "school-class-route-boundary",
    });

    return <SchoolNotFound />;
  }
}
