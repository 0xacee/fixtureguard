import path from "node:path";

export function normalizePath(value) {
  return value.split(path.sep).join("/").replace(/^\.\//, "");
}

export function globToRegExp(pattern) {
  const input = normalizePath(pattern);
  let source = "^";
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "*" && input[index + 1] === "*") {
      index += 1;
      if (input[index + 1] === "/") {
        index += 1;
        source += "(?:.*/)?";
      } else source += ".*";
    } else if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else source += char.replace(/[\\^$+?.()|{}\[\]]/g, "\\$&");
  }
  return new RegExp(`${source}$`);
}

export function matchesAny(value, patterns) {
  const normalized = normalizePath(value);
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
}
