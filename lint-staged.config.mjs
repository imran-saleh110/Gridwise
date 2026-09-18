const VENDORED_TOOL_DIRS = /[/\\]\.(agents|codex|opencode)[/\\]/u;

const quote = (file) => `'${file.replaceAll("'", "'\\''")}'`;

export default {
  "*.{js,jsx,ts,tsx,json,jsonc,css,scss,md,mdx}": (files) => {
    const targets = files.filter((file) => !VENDORED_TOOL_DIRS.test(file));

    if (targets.length === 0) {
      return [];
    }

    return [`bun x ultracite fix ${targets.map(quote).join(" ")}`];
  },
};
