import "server-only";

export function getGithubUrl(path: string) {
  return `${process.env.GITHUB_URL}${path}`;
}
