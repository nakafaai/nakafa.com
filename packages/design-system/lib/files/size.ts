/** Formats a byte count for compact attachment and asset labels. */
export function formatFileSize(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const base = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(base));
  const value = Number.parseFloat((bytes / base ** unitIndex).toFixed(1));

  return `${value} ${units[unitIndex]}`;
}
