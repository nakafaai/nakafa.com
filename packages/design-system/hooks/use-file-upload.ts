"use client";

import { selectFileBatch } from "@repo/design-system/lib/upload/selection";
import { Effect, Result } from "effect";
import { useTranslations } from "next-intl";
import type React from "react";
import {
  type ChangeEvent,
  type DragEvent,
  type InputHTMLAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const BASE36_RADIX = 36;
const RANDOM_STRING_START = 2;
const RANDOM_STRING_END = 9;

/** Describes a file that is already stored outside the browser. */
export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

/** Associates a selected file with its stable ID and optional preview URL. */
export interface FileWithPreview {
  file: File | FileMetadata;
  id: string;
  preview?: string;
}

/** Configures selection behavior; maxSize is bytes and maxFiles is for multiple mode. */
export interface FileUploadOptions {
  accept?: string;
  initialFiles?: FileMetadata[];
  maxFiles?: number;
  maxSize?: number;
  multiple?: boolean;
  onError?: (errors: string[]) => void;
  onFilesAdded?: (addedFiles: FileWithPreview[]) => void;
  onFilesChange?: (files: FileWithPreview[]) => void;
}

/** Represents selected files, drag state, and validation errors. */
export interface FileUploadState {
  errors: string[];
  files: FileWithPreview[];
  isDragging: boolean;
}

/** Exposes file selection and drag-and-drop actions for UI adapters. */
export interface FileUploadActions {
  addFiles: (files: FileList | File[]) => void;
  clearErrors: () => void;
  clearFiles: () => void;
  getInputProps: (
    props?: InputHTMLAttributes<HTMLInputElement>
  ) => InputHTMLAttributes<HTMLInputElement> & {
    ref: React.Ref<HTMLInputElement>;
  };
  handleDragEnter: (e: DragEvent<HTMLElement>) => void;
  handleDragLeave: (e: DragEvent<HTMLElement>) => void;
  handleDragOver: (e: DragEvent<HTMLElement>) => void;
  handleDrop: (e: DragEvent<HTMLElement>) => void;
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  openFileDialog: () => void;
  removeFile: (id: string) => void;
}

/** Manages file validation, selection state, and browser preview lifetimes. */
export const useFileUpload = (
  options: FileUploadOptions = {}
): [FileUploadState, FileUploadActions] => {
  const t = useTranslations("File");

  const {
    maxFiles = Number.POSITIVE_INFINITY,
    maxSize = Number.POSITIVE_INFINITY,
    accept = "*",
    multiple = false,
    initialFiles = [],
    onFilesChange,
    onFilesAdded,
    onError,
  } = options;

  const [state, setState] = useState<FileUploadState>({
    files: initialFiles.map((file) => ({
      file,
      id: file.id,
      preview: file.url,
    })),
    isDragging: false,
    errors: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef(state.files);
  const objectUrlsRef = useRef(new Set<string>());

  /** Keeps imperative file actions aligned with the next rendered file list. */
  const updateFiles = useCallback(
    (files: FileWithPreview[], errors: string[]) => {
      filesRef.current = files;
      setState((prev) => ({ ...prev, files, errors }));
    },
    []
  );

  const createPreview = useCallback(
    (file: File | FileMetadata): string | undefined => {
      if (!(file instanceof File)) {
        return file.url;
      }

      if (!file.type.startsWith("image/")) {
        return;
      }

      const preview = URL.createObjectURL(file);
      objectUrlsRef.current.add(preview);
      return preview;
    },
    []
  );

  const revokePreview = useCallback((file: FileWithPreview) => {
    if (!(file.file instanceof File && file.preview)) {
      return;
    }

    if (!objectUrlsRef.current.delete(file.preview)) {
      return;
    }

    URL.revokeObjectURL(file.preview);
  }, []);

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;

    return () => {
      for (const objectUrl of objectUrls) {
        URL.revokeObjectURL(objectUrl);
      }
      objectUrls.clear();
    };
  }, []);

  const resetInput = useCallback(() => {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.value = "";
  }, []);

  const generateUniqueId = useCallback((file: File | FileMetadata): string => {
    if (file instanceof File) {
      return `${file.name}-${Date.now()}-${Math.random().toString(BASE36_RADIX).slice(RANDOM_STRING_START, RANDOM_STRING_END)}`;
    }
    return file.id;
  }, []);

  const clearFiles = useCallback(() => {
    for (const file of filesRef.current) {
      revokePreview(file);
    }

    resetInput();
    updateFiles([], []);
    onFilesChange?.([]);
  }, [onFilesChange, resetInput, revokePreview, updateFiles]);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      if (newFiles.length === 0) {
        return;
      }

      const currentFiles = filesRef.current;
      const selection = Effect.runSync(
        Effect.result(
          selectFileBatch({
            accept,
            currentFiles: currentFiles.map(({ file }) => file),
            files: Array.from(newFiles),
            maxFiles,
            maxSize,
            multiple,
          })
        )
      );
      if (Result.isFailure(selection)) {
        const errors = [
          t("max-files-exceeded", {
            maxFiles: selection.failure.maxFiles.toString(),
          }),
        ];
        setState((prev) => ({ ...prev, errors }));
        onError?.(errors);
        resetInput();
        return;
      }
      const errors = selection.success.errors.map((error) => {
        if (error._tag === "FileTypeError") {
          return t("not-accepted-file-type", { fileName: error.fileName });
        }
        return t(
          multiple ? "some-files-exceed-max-size" : "file-exceeds-max-size",
          {
            maxSizeFormatted: formatBytes(error.maxSize),
          }
        );
      });
      const validFiles = selection.success.files.map((file) => ({
        file,
        id: generateUniqueId(file),
        preview: createPreview(file),
      }));
      setState((prev) => ({ ...prev, errors }));

      if (!multiple) {
        for (const file of currentFiles) {
          revokePreview(file);
        }
      }

      if (!multiple || validFiles.length > 0) {
        const updatedFiles = multiple
          ? [...currentFiles, ...validFiles]
          : validFiles;
        updateFiles(updatedFiles, errors);
        if (validFiles.length > 0) {
          onFilesAdded?.(validFiles);
        }
        onFilesChange?.(updatedFiles);
      }

      if (errors.length > 0) {
        onError?.(errors);
      }

      resetInput();
    },
    [
      maxFiles,
      multiple,
      maxSize,
      accept,
      createPreview,
      generateUniqueId,
      revokePreview,
      onFilesChange,
      onFilesAdded,
      onError,
      resetInput,
      t,
      updateFiles,
    ]
  );

  const removeFile = useCallback(
    (id: string) => {
      const fileToRemove = filesRef.current.find((file) => file.id === id);
      if (!fileToRemove) {
        return;
      }

      revokePreview(fileToRemove);
      const newFiles = filesRef.current.filter((file) => file.id !== id);
      updateFiles(newFiles, []);
      onFilesChange?.(newFiles);
    },
    [onFilesChange, revokePreview, updateFiles]
  );

  const clearErrors = useCallback(() => {
    setState((prev) => ({
      ...prev,
      errors: [],
    }));
  }, []);

  const handleDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setState((prev) => ({ ...prev, isDragging: true }));
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      e.relatedTarget instanceof Node &&
      e.currentTarget.contains(e.relatedTarget)
    ) {
      return;
    }

    setState((prev) => ({ ...prev, isDragging: false }));
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setState((prev) => ({ ...prev, isDragging: false }));

      if (inputRef.current?.disabled) {
        return;
      }

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        if (multiple) {
          addFiles(e.dataTransfer.files);
        } else {
          const file = e.dataTransfer.files[0];
          addFiles([file]);
        }
      }
    },
    [addFiles, multiple]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
    },
    [addFiles]
  );

  const openFileDialog = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  }, []);

  const getInputProps = useCallback(
    (props: InputHTMLAttributes<HTMLInputElement> = {}) => ({
      ...props,
      type: "file" as const,
      onChange: handleFileChange,
      accept: props.accept || accept,
      multiple: props.multiple === undefined ? multiple : props.multiple,
      ref: inputRef,
    }),
    [accept, multiple, handleFileChange]
  );

  return [
    state,
    {
      addFiles,
      removeFile,
      clearFiles,
      clearErrors,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleFileChange,
      openFileDialog,
      getInputProps,
    },
  ];
};

/** Formats a byte count for file validation messages. */
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) {
    return "0 Bytes";
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Number.parseFloat((bytes / k ** i).toFixed(dm)) + sizes[i];
};
