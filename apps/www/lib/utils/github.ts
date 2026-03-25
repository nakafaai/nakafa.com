const GITHUB_URL = "/nakafaai/nakafa.com";

function normalizeGithubPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export function getGithubUrl({
  path,
  ref = "/tree/main",
}: {
  path: string;
  ref?: string;
}) {
  return `https://github.com${GITHUB_URL}${ref}${normalizeGithubPath(path)}` as const;
}

export function getRawGithubUrl(path: string) {
  const cleanPath = normalizeGithubPath(path);
  return `https://raw.githubusercontent.com${GITHUB_URL}/refs/heads/main${cleanPath}` as const;
}
