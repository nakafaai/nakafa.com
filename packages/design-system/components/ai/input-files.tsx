import { useStableMutableValue } from "@repo/design-system/hooks/use-stable-mutable-value";
import {
  type PromptInputFile,
  type PromptInputRefusal,
  refusalsAfterSend,
  refusedFiles,
  validatePromptInputFiles,
} from "@repo/design-system/lib/prompt-input/files";
import { randomUuid } from "@repo/utilities/uuid";
import {
  Array as Arr,
  Effect,
  HashSet,
  MutableHashMap,
  Option,
  Schema,
} from "effect";
import {
  type RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const PromptInputFilesLimitsSchema = Schema.Struct({
  accept: Schema.optional(Schema.String),
  maxFileSize: Schema.optional(Schema.Finite),
  maxFiles: Schema.optional(Schema.Finite),
});
type PromptInputFilesLimits = typeof PromptInputFilesLimitsSchema.Type;

/**
 * Owns selected files, the lifetime of their browser preview URLs, and the files
 * that the last pick refused. Each pick replaces the refused files of the pick
 * before it, so a refused file shows until its learner removes it, picks again,
 * or the composer's message goes.
 */
export function usePromptInputFiles({
  accept,
  inputRef,
  maxFiles,
  maxFileSize,
}: PromptInputFilesLimits & {
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const [items, setItems] = useState<PromptInputFile[]>([]);
  const [refusals, setRefusals] = useState<readonly PromptInputRefusal[]>([]);
  const localItemsRef = useRef<PromptInputFile[]>([]);
  const localUrls = useStableMutableValue(() =>
    MutableHashMap.empty<string, string>()
  );
  const files = items;
  const fileCountRef = useRef(files.length);
  const fileIdsRef = useRef(HashSet.empty<string>());
  useLayoutEffect(() => {
    fileCountRef.current = files.length;
    fileIdsRef.current = HashSet.fromIterable(
      Arr.map(files, (file) => file.id)
    );
  }, [files]);
  const openFileDialogLocal = useCallback(() => {
    inputRef.current?.click();
  }, [inputRef]);
  const addLocal = useCallback(
    (selectedFiles: readonly File[]) => {
      const next = Arr.map(selectedFiles, (file): PromptInputFile => {
        const id = Effect.runSync(randomUuid);
        const url = URL.createObjectURL(file);
        MutableHashMap.set(localUrls, id, url);
        return {
          id,
          file,
          type: "file",
          url,
          mediaType: file.type,
          filename: file.name,
        };
      });
      const nextItems = Arr.appendAll(localItemsRef.current, next);
      localItemsRef.current = nextItems;
      setItems(nextItems);
    },
    [localUrls]
  );
  const removeLocal = useCallback(
    (id: string) => {
      const url = MutableHashMap.get(localUrls, id);
      if (Option.isSome(url)) {
        URL.revokeObjectURL(url.value);
        MutableHashMap.remove(localUrls, id);
      }
      const nextItems = Arr.filter(
        localItemsRef.current,
        (file) => file.id !== id
      );
      localItemsRef.current = nextItems;
      setItems(nextItems);
    },
    [localUrls]
  );
  const clearLocal = useCallback(() => {
    for (const url of MutableHashMap.values(localUrls)) {
      URL.revokeObjectURL(url);
    }
    MutableHashMap.clear(localUrls);
    localItemsRef.current = [];
    setItems([]);
  }, [localUrls]);
  const add = useCallback(
    (fileList: File[] | FileList) => {
      const selection = Effect.runSync(
        validatePromptInputFiles({
          ...(accept === undefined ? {} : { accept }),
          currentFileCount: fileCountRef.current,
          files: Array.from(fileList),
          maxFileSize,
          maxFiles,
        })
      );
      setRefusals(
        Arr.map(refusedFiles(selection.rejections), (refusal) => ({
          ...refusal,
          id: Effect.runSync(randomUuid),
        }))
      );
      if (selection.files.length === 0) {
        return;
      }
      addLocal(selection.files);
      fileCountRef.current += selection.files.length;
    },
    [accept, addLocal, maxFileSize, maxFiles]
  );
  const remove = useCallback(
    (id: string) => {
      if (HashSet.has(fileIdsRef.current, id)) {
        fileIdsRef.current = HashSet.remove(fileIdsRef.current, id);
        fileCountRef.current = Math.max(0, fileCountRef.current - 1);
      }
      removeLocal(id);
      setRefusals((current) =>
        Arr.filter(current, (refusal) => refusal.id !== id)
      );
    },
    [removeLocal]
  );
  const dismissRefusals = useCallback(
    (sent: readonly PromptInputRefusal[]) =>
      setRefusals((current) => refusalsAfterSend(current, sent)),
    []
  );
  const clear = useCallback(() => {
    fileCountRef.current = 0;
    fileIdsRef.current = HashSet.empty();
    clearLocal();
    setRefusals([]);
  }, [clearLocal]);
  const openFileDialog = openFileDialogLocal;
  useLayoutEffect(() => {
    // Activity preserves the draft while releasing effects. Restore preview
    // resources before the preserved input becomes visible again.
    let restored = false;
    const next = Arr.map(localItemsRef.current, (item) => {
      if (MutableHashMap.has(localUrls, item.id)) {
        return item;
      }
      const url = URL.createObjectURL(item.file);
      MutableHashMap.set(localUrls, item.id, url);
      restored = true;
      return { ...item, url };
    });
    if (restored) {
      localItemsRef.current = next;
      setItems(next);
    }
    return () => {
      for (const url of MutableHashMap.values(localUrls)) {
        URL.revokeObjectURL(url);
      }
      MutableHashMap.clear(localUrls);
    };
  }, [localUrls]);
  const attachments = useMemo(
    () => ({
      files,
      refusals,
      add,
      dismissRefusals,
      remove,
      clear,
      openFileDialog,
      fileInputRef: inputRef,
    }),
    [
      files,
      refusals,
      add,
      dismissRefusals,
      remove,
      clear,
      openFileDialog,
      inputRef,
    ]
  );
  return { attachments, files };
}
