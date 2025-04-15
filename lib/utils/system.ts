import fs from "node:fs";
import path from "node:path";

/**
 * Gets the child names of the folder.
 * @param folder - The folder to get the child names for.
 * @returns The child names of the folder.
 */
export function getFolderChildNames(folder: string) {
  try {
    // For more reliable path resolution during both build and development
    const contentDir = path.join(process.cwd(), folder);

    // Read directory synchronously - required for Next.js static generation
    const files = fs.readdirSync(contentDir, { withFileTypes: true });

    // Filter directories and return their names
    const dirs = files.filter((dirent) => dirent.isDirectory());
    return dirs.map((dirent) => dirent.name);
  } catch {
    return [];
  }
}
