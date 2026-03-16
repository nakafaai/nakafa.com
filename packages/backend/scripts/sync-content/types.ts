import type { Locale } from "../lib/mdxParser";

export type { Locale } from "../lib/mdxParser";

export interface SyncOptions {
  authors?: boolean;
  force?: boolean;
  incremental?: boolean;
  locale?: Locale;
  prod?: boolean;
  quiet?: boolean;
  sequential?: boolean;
}

export interface SyncState {
  lastSyncCommit: string;
  lastSyncTimestamp: number;
}

export interface PhaseMetrics {
  durationMs?: number;
  endTime?: number;
  itemCount: number;
  itemsPerSecond?: number;
  phase: string;
  startTime: number;
}

export interface SyncMetrics {
  phases: PhaseMetrics[];
  totalDurationMs?: number;
  totalEndTime?: number;
  totalItems?: number;
  totalStartTime: number;
}

export interface BatchProgress {
  batchSize: number;
  processedItems: number;
  startTime: number;
  totalItems: number;
}

export interface SyncResult {
  authorLinksCreated?: number;
  choicesCreated?: number;
  created: number;
  durationMs?: number;
  itemsPerSecond?: number;
  referencesCreated?: number;
  skipped?: number;
  skippedSetSlugs?: string[];
  unchanged: number;
  updated: number;
}

export interface AuthorSyncResult {
  created: number;
  durationMs?: number;
  existing: number;
}

export interface ConvexConfig {
  accessToken: string;
  url: string;
}

export interface StaleItem {
  id: string;
  locale: Locale;
  slug: string;
}

export interface ValidationError {
  error: string;
  file: string;
}

export interface ValidationResult {
  errors: ValidationError[];
  invalid: number;
  valid: number;
}

export interface FilesystemSlugs {
  articleSlugs: string[];
  exerciseQuestionSlugs: string[];
  exerciseSetSlugs: string[];
  subjectSectionSlugs: string[];
  subjectTopicSlugs: string[];
}
