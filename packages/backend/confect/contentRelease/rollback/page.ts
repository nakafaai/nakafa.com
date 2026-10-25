import {
  canonicalizeRollbackPage,
  type RollbackPage,
} from "@nakafa/aksara-contracts/release/rollback/spec";
import { Array as Arr } from "effect";

const textEncoder = new TextEncoder();
const RECORDS_OPEN = '"records":[';

/**
 * Measures the exact canonical bytes of one page from its header, the bytes of its records, and
 * one comma between each pair, so a walk can test a candidate page without serializing its
 * records again.
 */
export function rollbackPageBytes(page: RollbackPage, recordBytes: number) {
  const header = canonicalizeRollbackPage({ ...page, records: [] });
  const separators = Math.max(0, page.records.length - 1);
  return textEncoder.encode(header).byteLength + recordBytes + separators;
}

/**
 * Serializes one page from the canonical text of its records. The contract writes the page header
 * around its records array, so the header splits right after the opening bracket of that array and
 * the joined record text goes between the two halves. The result is byte-identical to
 * `canonicalizeRollbackPage` on the same page.
 */
export function serializeRollbackPage(
  page: RollbackPage,
  recordTexts: readonly string[]
) {
  const header = canonicalizeRollbackPage({ ...page, records: [] });
  const cut = header.indexOf(RECORDS_OPEN) + RECORDS_OPEN.length;
  return `${header.slice(0, cut)}${Arr.join(recordTexts, ",")}${header.slice(cut)}`;
}
