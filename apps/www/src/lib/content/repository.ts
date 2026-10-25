import type { GitCommitSha } from "@nakafa/aksara-contracts/ids";
import { withLeadingSlash } from "@repo/utilities/path";

const GITHUB_URL = "/nakafaai/nakafa.com";
const AKSARA_URL = "/nakafaai/aksara";

/** Builds one Nakafa repository browser URL at a branch, tag, or commit ref. */
export function getGithubUrl({
  path,
  ref = "/tree/main",
}: {
  path: string;
  ref?: string;
}) {
  return `https://github.com${GITHUB_URL}${ref}${withLeadingSlash(path)}` as const;
}

/** Builds one raw Nakafa source URL from the current main branch. */
export function getRawGithubUrl(path: string) {
  const cleanPath = withLeadingSlash(path);
  return `https://raw.githubusercontent.com${GITHUB_URL}/refs/heads/main${cleanPath}` as const;
}

/** Builds one immutable Aksara source browser URL at an exact Git commit. */
export function getAksaraUrl({
  path,
  revision,
}: {
  readonly path: string;
  readonly revision: GitCommitSha;
}) {
  return `https://github.com${AKSARA_URL}/blob/${revision}${withLeadingSlash(path)}` as const;
}

/** Builds one immutable Aksara directory browser URL at an exact Git commit. */
export function getAksaraTreeUrl({
  path,
  revision,
}: {
  readonly path: string;
  readonly revision: GitCommitSha;
}) {
  return `https://github.com${AKSARA_URL}/tree/${revision}${withLeadingSlash(path)}` as const;
}

/** Builds one immutable raw Aksara source URL at an exact Git commit. */
export function getRawAksaraUrl({
  path,
  revision,
}: {
  readonly path: string;
  readonly revision: GitCommitSha;
}) {
  return `https://raw.githubusercontent.com${AKSARA_URL}/${revision}${withLeadingSlash(path)}` as const;
}
