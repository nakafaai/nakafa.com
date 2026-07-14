"use client";

import type {
  AttachmentsContext,
  PromptInputController,
} from "@repo/design-system/components/ai/input-context";
import {
  type PromptInputFile,
  type PromptInputFileConstraintError,
  validatePromptInputFiles,
} from "@repo/design-system/lib/prompt-input-files";
import { Effect, Either } from "effect";
import { nanoid } from "nanoid";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface PromptInputFilesOptions {
  accept?: string;
  controller: PromptInputController | null;
  inputRef: RefObject<HTMLInputElement | null>;
  maxFileSize?: number;
  maxFiles?: number;
  onError?: (error: PromptInputFileConstraintError) => void;
}

/** Owns local prompt files while delegating to a provider when one is present. */
export function usePromptInputFiles({
  accept,
  controller,
  inputRef,
  maxFiles,
  maxFileSize,
  onError,
}: PromptInputFilesOptions) {
  const [items, setItems] = useState<PromptInputFile[]>([]);
  const localItemsRef = useRef<PromptInputFile[]>([]);
  const localUrlsRef = useRef(new Map<string, string>());
  const files = controller ? controller.attachments.files : items;
  const fileCountRef = useRef(files.length);
  const fileIdsRef = useRef(new Set(files.map((file) => file.id)));

  useLayoutEffect(() => {
    fileCountRef.current = files.length;
    fileIdsRef.current = new Set(files.map((file) => file.id));
  }, [files]);

  const openFileDialogLocal = useCallback(() => {
    inputRef.current?.click();
  }, [inputRef]);

  const addLocal = useCallback((selectedFiles: readonly File[]) => {
    const next = selectedFiles.map((file): PromptInputFile => {
      const id = nanoid();
      const url = URL.createObjectURL(file);
      localUrlsRef.current.set(id, url);

      return {
        id,
        type: "file",
        url,
        mediaType: file.type,
        filename: file.name,
      };
    });
    const nextItems = localItemsRef.current.concat(next);
    localItemsRef.current = nextItems;
    setItems(nextItems);
  }, []);

  const removeLocal = useCallback((id: string) => {
    const url = localUrlsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      localUrlsRef.current.delete(id);
    }

    const nextItems = localItemsRef.current.filter((file) => file.id !== id);
    localItemsRef.current = nextItems;
    setItems(nextItems);
  }, []);

  const clearLocal = useCallback(() => {
    for (const url of localUrlsRef.current.values()) {
      URL.revokeObjectURL(url);
    }
    localUrlsRef.current.clear();
    localItemsRef.current = [];
    setItems([]);
  }, []);

  const add = useCallback(
    (fileList: File[] | FileList) => {
      const result = Effect.runSync(
        Effect.either(
          validatePromptInputFiles({
            accept,
            currentFileCount: fileCountRef.current,
            files: Array.from(fileList),
            maxFileSize,
            maxFiles,
          })
        )
      );
      if (Either.isLeft(result)) {
        onError?.(result.left);
        return;
      }

      if (result.right.warning) {
        onError?.(result.right.warning);
      }
      if (result.right.files.length === 0) {
        return;
      }

      if (controller) {
        controller.attachments.add(result.right.files);
        fileCountRef.current += result.right.files.length;
        return;
      }
      addLocal(result.right.files);
      fileCountRef.current += result.right.files.length;
    },
    [accept, addLocal, controller, maxFileSize, maxFiles, onError]
  );
  const remove = useCallback(
    (id: string) => {
      if (fileIdsRef.current.delete(id)) {
        fileCountRef.current = Math.max(0, fileCountRef.current - 1);
      }

      if (controller) {
        controller.attachments.remove(id);
        return;
      }
      removeLocal(id);
    },
    [controller, removeLocal]
  );
  const clear = useCallback(() => {
    fileCountRef.current = 0;
    fileIdsRef.current.clear();
    if (controller) {
      controller.attachments.clear();
      return;
    }
    clearLocal();
  }, [clearLocal, controller]);
  const openFileDialog = controller
    ? controller.attachments.openFileDialog
    : openFileDialogLocal;

  useEffect(() => {
    if (!controller) {
      return;
    }
    controller.__registerFileInput(inputRef, () => inputRef.current?.click());
  }, [controller, inputRef]);

  useEffect(
    () => () => {
      if (controller) {
        return;
      }
      for (const url of localUrlsRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      localUrlsRef.current.clear();
    },
    [controller]
  );

  const attachments = useMemo<AttachmentsContext>(
    () => ({
      files: files.map((item) => ({ ...item, id: item.id })),
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
