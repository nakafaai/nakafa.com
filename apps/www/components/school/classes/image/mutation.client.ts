"use client";

import { useMutation } from "@confect/react";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import classes from "@repo/backend/confect/_generated/refs/classes";
import type { SchoolClassImage } from "@repo/backend/confect/classes/schema";
import { Array as Arr, Option } from "effect";
import { updateClassImageState } from "@/components/school/classes/image/state";
import { useClass } from "@/lib/school/classes/context";

/** Replace the class image across every loaded school class page. */
function updateClassLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  classId: string,
  image: SchoolClassImage
) {
  for (const query of localStore.getAllQueries(classes.queries.getClasses)) {
    if (Option.isNone(query.value)) {
      continue;
    }
    localStore.setQuery(
      classes.queries.getClasses,
      query.args,
      Option.some({
        ...query.value.value,
        page: Arr.map(query.value.value.page, (schoolClass) =>
          schoolClass._id === classId
            ? {
                ...schoolClass,
                image,
              }
            : schoolClass
        ),
      })
    );
  }
}

/** Return a class-image mutation that updates the hydrated route immediately. */
export function useClassImageMutation() {
  const preloadedRoute = useClass((state) => state);
  return useMutation(classes.mutations.updateClassImage).withOptimisticUpdate(
    (localStore, args) => {
      const queryArgs = {
        classId: args.classId,
      };
      const cachedRoute = Option.getOrUndefined(
        localStore.getQuery(classes.queries.getClassRoute, queryArgs)
      );
      if (cachedRoute && cachedRoute.kind !== "accessible") {
        return;
      }
      const route = cachedRoute ?? preloadedRoute;
      localStore.setQuery(
        classes.queries.getClassRoute,
        queryArgs,
        Option.some(updateClassImageState(route, args.image))
      );
      updateClassLists(localStore, args.classId, args.image);
    }
  );
}
