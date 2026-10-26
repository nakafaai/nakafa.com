import { useAction, useMutation } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect } from "effect";
import { importIntoExam } from "@/components/tenant/exams/import/start";

/**
 * The import of a file into an exam of this school, from a browser event: Nina's read, the
 * placement, the keys and the image uploads, bound to the exam. The import runs detached, so it
 * outlives the dialog it starts from and the page it opens, and its toast follows it.
 */
export function useImportFile(slug: TenantSlug) {
  const requestUrl = useMutation(exams.assets.uploadUrl);
  const register = useAction(exams.assets.register);
  const read = useAction(exams.reads.read);
  const place = useMutation(exams.imports.place);
  const keys = useMutation(exams.imports.keys);

  return (examId: Id<"exams">, file: File) =>
    Effect.forkDetach(
      importIntoExam({
        examId,
        file,
        keys: (entries) => keys({ examId, keys: entries, slug }),
        place: (questions) => place({ examId, questions, slug }),
        read: (source) => read({ examId, slug, source }),
        register: (args) => register({ examId, slug, ...args }),
        requestUrl: () => requestUrl({ examId, slug }),
      })
    );
}
