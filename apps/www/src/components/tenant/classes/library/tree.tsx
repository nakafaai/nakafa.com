import { QueryResult, useQuery } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { useConvexAuth } from "@/components/auth/convex";
import { useClassScope } from "@/components/tenant/classes/scope";

/** The folders of the class around the caller, oldest first, none while they load. */
export function useFolderList() {
  const { classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const folders = useQuery(
    classroom.folders.list,
    isSettled ? { classId, slug } : "skip"
  );

  if (QueryResult.isFailure(folders)) {
    throw folders.error;
  }
  return QueryResult.isSuccess(folders) ? folders.value : [];
}
