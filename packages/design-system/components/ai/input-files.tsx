"use client";
import { useStableMutableValue } from "@repo/design-system/hooks/use-stable-mutable-value";
import type { AttachmentsContext } from "@repo/design-system/lib/prompt-input/context";
import {
  type PromptInputFile,
  type PromptInputFileConstraintError,
  validatePromptInputFiles,
} from "@repo/design-system/lib/prompt-input/files";
import { Effect, Result } from "effect";
import { nanoid } from "nanoid";
import {
  type RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface PromptInputFilesOptions {
  accept?: string | undefined;
  inputRef: RefObject<HTMLInputElement | null>;
  maxFileSize?: number | undefined;
  maxFiles?: number | undefined;
  onError?: ((error: PromptInputFileConstraintError) => void) | undefined;
}
/** Owns selected files and the lifetime of their browser preview URLs. */
export function usePromptInputFiles({
  accept,
  inputRef,
  maxFiles,
  maxFileSize,
  onError,
}: PromptInputFilesOptions) {
  const [items, setItems] = useState<PromptInputFile[]>([]);
  const localItemsRef = useRef<PromptInputFile[]>([]);
  const localUrls = useStableMutableValue(() => new Map<string, string>());
  const files = items;
  const fileCountRef = useRef(files.length);
  const [fileIds] = useState(() => new Set(files.map((file) => file.id)));
  useLayoutEffect(() => {
    fileCountRef.current = files.length;
    fileIds.clear();
    for (const file of files) {
      fileIds.add(file.id);
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
        localUrls.set(id, url);
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
      const url = localUrls.get(id);
      if (url) {
        URL.revokeObjectURL(url);
        localUrls.delete(id);
      }
      const nextItems = localItemsRef.current.filter((file) => file.id !== id);
      localItemsRef.current = nextItems;
      setItems(nextItems);
    },
    [localUrls]
  );
  const clearLocal = useCallback(() => {
    for (const url of localUrls.values()) {
      URL.revokeObjectURL(url);
    }
    localUrls.clear();
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
      if (fileIds.delete(id)) {
        fileCountRef.current = Math.max(0, fileCountRef.current - 1);
      }
      removeLocal(id);
    },
    [fileIds, removeLocal]
  );
  const clear = useCallback(() => {
    fileCountRef.current = 0;
    fileIds.clear();
    clearLocal();
  }, [clearLocal, fileIds]);
  const openFileDialog = openFileDialogLocal;
  useLayoutEffect(() => {
    // Activity preserves the draft while releasing effects. Restore preview
    // resources before the preserved input becomes visible again.
    let restored = false;
    const next = localItemsRef.current.map((item) => {
      if (localUrls.has(item.id)) {
        return item;
      }
      const url = URL.createObjectURL(item.file);
      localUrls.set(item.id, url);
      restored = true;
      return { ...item, url };
    });
    if (restored) {
      localItemsRef.current = next;
      setItems(next);
    }
    return () => {
      for (const url of localUrls.values()) {
        URL.revokeObjectURL(url);
      }
      localUrls.clear();
    };
  }, [localUrls]);
  const attachments = useMemo<AttachmentsContext>(
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
