"use client";

import { type OptimisticLocalStore, useMutation } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Option, Schema } from "effect";
import { finishAttempt } from "@/components/exams/sitting/attempt";
import {
  type PaperValue,
  setPaperResponse,
} from "@/components/exams/sitting/paper";

/** The sitting and the school of one student's attempt, which every call names. */
const SittingKey = Schema.Struct({
  sittingId: Id("examSittings"),
  slug: TenantSlug,
});

/** The key of one student's paper: the device that holds the attempt, and its sitting. */
const PaperKey = Schema.Struct({
  deviceId: Schema.String,
  sittingId: Id("examSittings"),
  slug: TenantSlug,
});

/** Replaces the paper that the local store holds for one student, when the store holds it. */
function changePaper(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  key: typeof PaperKey.Type,
  change: (paper: PaperValue) => PaperValue
) {
  const args = {
    deviceId: key.deviceId,
    sittingId: key.sittingId,
    slug: key.slug,
  };
  const current = Option.getOrUndefined(
    localStore.getQuery(exams.sittings.paper, args)
  );
  if (current !== undefined) {
    localStore.setQuery(
      exams.sittings.paper,
      args,
      Option.some(change(current))
    );
  }
}

/** Marks the student's attempt submitted in the local store, when the store holds it. */
function changeAttempt(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  key: typeof SittingKey.Type
) {
  const args = { sittingId: key.sittingId, slug: key.slug };
  const current = Option.getOrNull(
    localStore.getQuery(exams.sittings.attempt, args)
  );
  if (current !== null) {
    localStore.setQuery(
      exams.sittings.attempt,
      args,
      Option.some(finishAttempt(current))
    );
  }
}

/** Saves one response at once: the screen shows the chosen option, and a refused answer rolls back. */
export function useAnswer() {
  return useMutation(exams.sittings.answer).withOptimisticUpdate(
    (localStore, args) =>
      changePaper(localStore, args, (paper) =>
        setPaperResponse(paper, args.questionId, args.response)
      )
  );
}

/** Finishes the student's attempt at once: the answers close, and a refused finish rolls back. */
export function useFinish() {
  return useMutation(exams.sittings.finish).withOptimisticUpdate(
    (localStore, args) => changeAttempt(localStore, args)
  );
}
