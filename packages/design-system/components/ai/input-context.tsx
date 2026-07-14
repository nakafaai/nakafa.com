"use client";

import type { PromptInputFile } from "@repo/design-system/lib/prompt-input-files";
import { nanoid } from "nanoid";
import {
  createContext,
  type PropsWithChildren,
  type RefObject,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** Attachment state shared by prompt input composition components. */
export interface AttachmentsContext {
  add: (files: File[] | FileList) => void;
  clear: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  files: PromptInputFile[];
  openFileDialog: () => void;
  remove: (id: string) => void;
}

/** Controlled prompt text exposed by the optional provider. */
export interface TextInputContext {
  clear: () => void;
  clearIfUnchanged: (submittedValue: string) => void;
  setInput: (value: string) => void;
  value: string;
}

/** State and file-input registration exposed by the optional provider. */
export interface PromptInputController {
  /** Connects the provider to the hidden file input owned by PromptInput. */
  __registerFileInput: (
    ref: RefObject<HTMLInputElement | null>,
    open: () => void
  ) => void;
  attachments: AttachmentsContext;
  textInput: TextInputContext;
}

const PromptInputContext = createContext<PromptInputController | null>(null);
const ProviderAttachmentsContext = createContext<AttachmentsContext | null>(
  null
);
const LocalAttachmentsContext = createContext<AttachmentsContext | null>(null);

/** Reads the required prompt controller from the nearest global provider. */
export function usePromptInputController() {
  const context = use(PromptInputContext);
  if (!context) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use usePromptInputController()."
    );
  }
  return context;
}

/** Reads the global prompt controller when one is present. */
export function useOptionalPromptInputController() {
  return use(PromptInputContext);
}

/** Reads the required attachment state from the nearest global provider. */
export function useProviderAttachments() {
  const context = use(ProviderAttachmentsContext);
  if (!context) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use useProviderAttachments()."
    );
  }
  return context;
}

/** Reads global attachment state when a provider is present. */
export function useOptionalProviderAttachments() {
  return use(ProviderAttachmentsContext);
}

/** Reads provider attachment state first, then local PromptInput state. */
export function usePromptInputAttachments() {
  const provider = useOptionalProviderAttachments();
  const scoped = use(LocalAttachmentsContext);
  const context = scoped ?? provider;
  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput or PromptInputProvider"
    );
  }
  return context;
}

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
