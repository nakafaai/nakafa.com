const defaultExclude = ["_", "node_modules", ".", "coverage"] as const;

interface ContentDirectoryEntry {
  isDirectory: () => boolean;
  name: string;
}

/** Returns whether a directory name matches an exclusion pattern. */
export function shouldExclude(name: string, excludeItems: readonly string[]) {
  for (const excludeItem of excludeItems) {
    if (name === excludeItem || name.startsWith(excludeItem)) {
      return true;
    }
  }

  return false;
}

/** Returns child directory names after applying default and custom exclusions. */
export function filterDirectoryNames(
  files: ContentDirectoryEntry[],
  customExclude?: string[]
) {
  const dirNames: string[] = [];
  const hasCustomExclude = customExclude && customExclude.length > 0;

  for (const dirent of files) {
    if (!dirent.isDirectory()) {
      continue;
    }

    const name = dirent.name;

    if (shouldExclude(name, defaultExclude)) {
      continue;
    }

    if (hasCustomExclude && shouldExclude(name, customExclude)) {
      continue;
    }

    dirNames.push(name);
  }

  return dirNames;
}
