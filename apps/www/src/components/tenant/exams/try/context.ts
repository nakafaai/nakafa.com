import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { createContext, use } from "react";
import { type StoreApi, useStore } from "zustand";
import type { ExamTry } from "@/components/tenant/exams/try/store";

/** The school of the try, which the try page provides. */
export const TrySlugContext = createContext<TenantSlug | null>(null);

/** The try's own answers, which the try page creates once for its instance. */
export const TryStoreContext = createContext<StoreApi<ExamTry> | null>(null);

/** Reads the school of the try. It throws outside the try page, which always provides it. */
export function useTrySlug() {
  const slug = use(TrySlugContext);
  if (slug === null) {
    throw new TypeError("useTrySlug must be used within ExamTryPaper");
  }
  return slug;
}

/** Reads one part of the try's answers. It throws outside the try page, which always provides it. */
export function useExamTry<Selected>(selector: (state: ExamTry) => Selected) {
  const store = use(TryStoreContext);
  if (store === null) {
    throw new TypeError("useExamTry must be used within ExamTryPaper");
  }
  return useStore(store, selector);
}
