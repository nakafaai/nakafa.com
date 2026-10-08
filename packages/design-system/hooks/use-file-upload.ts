"use client";

import { selectFileBatch } from "@repo/design-system/lib/upload/selection";
import {
  Array as Arr,
  Effect,
  HashSet,
  MutableHashSet,
  Result,
  Schema,
} from "effect";
import { useTranslations } from "next-intl";
import {
  type ChangeEvent,
  type DragEvent,
  type InputHTMLAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const FileMetadataSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  size: Schema.Finite,
  type: Schema.String,
  url: Schema.String,
});

/** Describes a file that is already stored outside the browser. */
export type FileMetadata = typeof FileMetadataSchema.Type;

const FileWithPreviewSchema = Schema.Struct({
  file: Schema.Union([Schema.instanceOf(File), FileMetadataSchema]),
  id: Schema.String,
  preview: Schema.optional(Schema.String),
});

/** Associates a selected file with its stable ID and optional preview URL. */
export type FileWithPreview = typeof FileWithPreviewSchema.Type;

const FileUploadOptionsSchema = Schema.Struct({
  accept: Schema.optionalKey(Schema.String),
  initialFiles: Schema.optionalKey(Schema.Array(FileMetadataSchema)),
  maxFiles: Schema.optionalKey(Schema.Finite),
  maxSize: Schema.optionalKey(Schema.Finite),
  multiple: Schema.optionalKey(Schema.Boolean),
});

/** Configures selection behavior; maxSize is bytes and maxFiles is for multiple mode. */
export type FileUploadOptions = typeof FileUploadOptionsSchema.Type;

/** Receives the validation messages of a selection that rejected files. */
type FileUploadErrorHandler = (errors: string[]) => void;

/** Receives the files that one selection added, with their IDs and previews. */
type FileUploadAddedHandler = (addedFiles: FileWithPreview[]) => void;

/** Receives the complete file list after it changes. */
type FileUploadChangeHandler = (files: FileWithPreview[]) => void;

const FileUploadStateSchema = Schema.Struct({
  errors: Schema.Array(Schema.String),
  files: Schema.Array(FileWithPreviewSchema),
  isDragging: Schema.Boolean,
});

/** Represents selected files, drag state, and validation errors. */
export type FileUploadState = typeof FileUploadStateSchema.Type;

/** Manages file validation, selection state, and browser preview lifetimes. */
export const useFileUpload = (
  options: FileUploadOptions & {
    onError?: FileUploadErrorHandler;
    onFilesAdded?: FileUploadAddedHandler;
    onFilesChange?: FileUploadChangeHandler;
  } = {}
) => {
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
  const objectUrlsRef = useRef(MutableHashSet.empty<string>());
  const pickedCountRef = useRef(0);

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
      MutableHashSet.add(objectUrlsRef.current, preview);
      return preview;
    },
    []
  );

  const revokePreview = useCallback((file: FileWithPreview) => {
    if (!(file.file instanceof File && file.preview)) {
      return;
    }

    if (!MutableHashSet.has(objectUrlsRef.current, file.preview)) {
      return;
    }

    MutableHashSet.remove(objectUrlsRef.current, file.preview);
    URL.revokeObjectURL(file.preview);
  }, []);

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;

    return () => {
      for (const objectUrl of objectUrls) {
        URL.revokeObjectURL(objectUrl);
      }
      MutableHashSet.clear(objectUrls);
    };
  }, []);

  const resetInput = useCallback(() => {
    if (!inputRef.current) {
      return;
    }

    inputRef.current.value = "";
  }, []);

  const generateUniqueId = useCallback((file: File | FileMetadata): string => {
    if (!(file instanceof File)) {
      return file.id;
    }
    // A picked file needs an id no other file in this hook holds. The counter
    // keeps picked files apart, and the loop skips an id a stored file brought.
    const held = HashSet.fromIterable(
      Arr.map(filesRef.current, (entry) => entry.id)
    );
    let id = "";
    do {
      pickedCountRef.current += 1;
      id = `${file.name}-${pickedCountRef.current}`;
    } while (HashSet.has(held, id));
    return id;
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

  const actions = {
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
  };

  return [state, actions] satisfies [FileUploadState, typeof actions];
};

/** Exposes file selection and drag-and-drop actions for UI adapters. */
export type FileUploadActions = ReturnType<typeof useFileUpload>[1];

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
