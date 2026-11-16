import type { GenericId } from "@confect/core";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { useRequired } from "@repo/design-system/hooks/required";
import { createContext } from "react";
import { type StoreApi, useStore } from "zustand";
import type { ExamTry } from "@/components/tenant/exams/try/store";

/** The exam of the try, which the try page provides. */
export const TryExamIdContext =
  createContext<GenericId.GenericId<"exams"> | null>(null);

/** The school of the try, which the try page provides. */
export const TrySlugContext = createContext<TenantSlug | null>(null);

/**
 * Whether the try's exam was deleted, or closed to the teacher, after the page read it. Its texts then
 * read no more and keep what they showed, so the deletion of their documents fails no read.
 */
export const TryGoneContext = createContext(false);

/** The try's own answers, which the try page creates once for its instance. */
export const TryStoreContext = createContext<StoreApi<ExamTry> | null>(null);

/** Reads the exam of the try. It throws outside the try page, which always provides it. */
export function useTryExamId() {
  return useRequired(TryExamIdContext, "useTryExamId");
}

/** Reads the school of the try. It throws outside the try page, which always provides it. */
export function useTrySlug() {
  return useRequired(TrySlugContext, "useTrySlug");
}

/** Reads one part of the try's answers. It throws outside the try page, which always provides it. */
export function useExamTry<Selected>(selector: (state: ExamTry) => Selected) {
  const store = useRequired(TryStoreContext, "useExamTry");
  return useStore(store, selector);
}
