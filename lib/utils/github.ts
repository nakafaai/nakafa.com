import "server-only";

const GITHUB_URL = process.env.GITHUB_URL;

export function getGithubUrl(path: string) {
  return `${GITHUB_URL}${path}`;
}
