import "server-only";

const GITHUB_URL = process.env.GITHUB_URL;

export function getGithubUrl(path: string) {
  return `https://github.com${GITHUB_URL}${path}`;
}

export function getRawGithubUrl(path: string) {
  return `https://raw.githubusercontent.com${GITHUB_URL}${path}`;
}
