const GITHUB_URL = "/nakafaai/nakafa.com";

export function getGithubUrl({
  path,
  ref = "/tree/main",
}: {
  path: string;
  ref?: string;
}) {
  return `https://github.com${GITHUB_URL}${ref}${path}` as const;
}

export function getRawGithubUrl(path: string) {
  return `https://raw.githubusercontent.com${GITHUB_URL}/refs/heads/main${path}` as const;
}
