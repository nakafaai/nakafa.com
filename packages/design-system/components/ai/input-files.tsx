"use client";
import { useStableMutableValue } from "@repo/design-system/hooks/use-stable-mutable-value";
import {
  type PromptInputFile,
  type PromptInputFileConstraintError,
  validatePromptInputFiles,
} from "@repo/design-system/lib/prompt-input/files";
import {
  Effect,
  MutableHashMap,
  MutableHashSet,
  Option,
  Result,
  Schema,
} from "effect";
import { nanoid } from "nanoid";
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
type OnPromptInputFileError = (error: PromptInputFileConstraintError) => void;

/** Owns selected files and the lifetime of their browser preview URLs. */
export function usePromptInputFiles({
  accept,
  inputRef,
  maxFiles,
  maxFileSize,
  onError,
}: PromptInputFilesLimits & {
  inputRef: RefObject<HTMLInputElement | null>;
  onError?: OnPromptInputFileError | undefined;
}) {
  const [items, setItems] = useState<PromptInputFile[]>([]);
  const localItemsRef = useRef<PromptInputFile[]>([]);
  const localUrls = useStableMutableValue(() =>
    MutableHashMap.empty<string, string>()
  );
  const files = items;
  const fileCountRef = useRef(files.length);
  const fileIds = useStableMutableValue(() =>
    MutableHashSet.fromIterable(files.map((file) => file.id))
  );
  useLayoutEffect(() => {
    fileCountRef.current = files.length;
    MutableHashSet.clear(fileIds);
    for (const file of files) {
      MutableHashSet.add(fileIds, file.id);
    }
  }, [fileIds, files]);
  const openFileDialogLocal = useCallback(() => {
    inputRef.current?.click();
  }, [inputRef]);
  const addLocal = useCallback(
    (selectedFiles: readonly File[]) => {
      const next = selectedFiles.map((file): PromptInputFile => {
        const id = nanoid();
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
      const nextItems = localItemsRef.current.concat(next);
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
      const nextItems = localItemsRef.current.filter((file) => file.id !== id);
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
      const result = Effect.runSync(
        Effect.result(
          validatePromptInputFiles({
            ...(accept === undefined ? {} : { accept }),
            currentFileCount: fileCountRef.current,
            files: Array.from(fileList),
            maxFileSize,
            maxFiles,
          })
        )
      );
      if (Result.isFailure(result)) {
        onError?.(result.failure);
        return;
      }
      if (result.success.warning) {
        onError?.(result.success.warning);
      }
      if (result.success.files.length === 0) {
        return;
      }
      addLocal(result.success.files);
      fileCountRef.current += result.success.files.length;
    },
    [accept, addLocal, maxFileSize, maxFiles, onError]
  );
  const remove = useCallback(
    (id: string) => {
      if (MutableHashSet.has(fileIds, id)) {
        MutableHashSet.remove(fileIds, id);
        fileCountRef.current = Math.max(0, fileCountRef.current - 1);
      }
      removeLocal(id);
    },
    [fileIds, removeLocal]
  );
  const clear = useCallback(() => {
    fileCountRef.current = 0;
    MutableHashSet.clear(fileIds);
    clearLocal();
  }, [clearLocal, fileIds]);
  const openFileDialog = openFileDialogLocal;
  useLayoutEffect(() => {
    // Activity preserves the draft while releasing effects. Restore preview
    // resources before the preserved input becomes visible again.
    let restored = false;
    const next = localItemsRef.current.map((item) => {
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
      add,
      remove,
      clear,
      openFileDialog,
      fileInputRef: inputRef,
    }),
    [files, add, remove, clear, openFileDialog, inputRef]
  );
  return { attachments, files };
}
