"use client";

import {
  type AttachmentsContext,
  LocalAttachmentsContext,
  PromptInputContext,
  type PromptInputController,
  ProviderAttachmentsContext,
} from "@repo/design-system/lib/prompt-input/context";
import type { PromptInputFile } from "@repo/design-system/lib/prompt-input/files";
import { nanoid } from "nanoid";
import {
  type PropsWithChildren,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** Props for lifting prompt text and attachment state above PromptInput. */
export type PromptInputProviderProps = PropsWithChildren<{
  initialInput?: string;
}>;

/** Lifts prompt text and attachment state above one or more inputs. */
export function PromptInputProvider({
  initialInput: initialTextInput = "",
  children,
}: PromptInputProviderProps) {
  const [textInput, setTextInput] = useState(initialTextInput);
  const textInputRef = useRef(initialTextInput);
  const updateTextInput = useCallback((value: string) => {
    textInputRef.current = value;
    setTextInput(value);
  }, []);
  const clearInput = useCallback(() => updateTextInput(""), [updateTextInput]);
  const clearInputIfUnchanged = useCallback(
    (submittedValue: string) => {
      if (textInputRef.current === submittedValue) {
        updateTextInput("");
      }
    },
    [updateTextInput]
  );
  const [files, setFiles] = useState<PromptInputFile[]>([]);
  const filesRef = useRef<PromptInputFile[]>([]);
  const fileUrlsRef = useRef(new Map<string, string>());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const openRef = useRef<() => void>(() => undefined);

  const add = useCallback((incomingFiles: File[] | FileList) => {
    const incoming = Array.from(incomingFiles);
    if (incoming.length === 0) {
      return;
    }

    const next = incoming.map((file): PromptInputFile => {
      const id = nanoid();
      const url = URL.createObjectURL(file);
      fileUrlsRef.current.set(id, url);

      return {
        id,
        type: "file",
        url,
        mediaType: file.type,
        filename: file.name,
      };
    });
    const nextFiles = filesRef.current.concat(next);
    filesRef.current = nextFiles;
    setFiles(nextFiles);
  }, []);

  const remove = useCallback((id: string) => {
    const url = fileUrlsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      fileUrlsRef.current.delete(id);
    }

    const nextFiles = filesRef.current.filter((file) => file.id !== id);
    filesRef.current = nextFiles;
    setFiles(nextFiles);
  }, []);

  const clear = useCallback(() => {
    for (const url of fileUrlsRef.current.values()) {
      URL.revokeObjectURL(url);
    }
    fileUrlsRef.current.clear();
    filesRef.current = [];
    setFiles([]);
  }, []);

  useEffect(
    () => () => {
      for (const url of fileUrlsRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      fileUrlsRef.current.clear();
    },
    []
  );

  const openFileDialog = useCallback(() => {
    openRef.current();
  }, []);

  const attachments = useMemo<AttachmentsContext>(
    () => ({
      files,
      add,
      remove,
      clear,
      openFileDialog,
      fileInputRef,
    }),
    [files, add, remove, clear, openFileDialog]
  );

  const registerFileInput = useCallback(
    (ref: RefObject<HTMLInputElement | null>, open: () => void) => {
      fileInputRef.current = ref.current;
      openRef.current = open;
    },
    []
  );

  const controller = useMemo<PromptInputController>(
    () => ({
      textInput: {
        value: textInput,
        setInput: updateTextInput,
        clear: clearInput,
        clearIfUnchanged: clearInputIfUnchanged,
      },
      attachments,
      __registerFileInput: registerFileInput,
    }),
    [
      textInput,
      updateTextInput,
      clearInput,
      clearInputIfUnchanged,
      attachments,
      registerFileInput,
    ]
  );

  return (
    <PromptInputContext.Provider value={controller}>
      <ProviderAttachmentsContext.Provider value={attachments}>
        {children}
      </ProviderAttachmentsContext.Provider>
    </PromptInputContext.Provider>
  );
}

/** Scopes attachment behavior to one composed PromptInput. */
export function PromptInputAttachmentsProvider({
  attachments,
  children,
}: PropsWithChildren<{ attachments: AttachmentsContext }>) {
  return (
    <LocalAttachmentsContext.Provider value={attachments}>
      {children}
    </LocalAttachmentsContext.Provider>
  );
}
