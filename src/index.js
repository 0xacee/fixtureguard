import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { matchesAny, normalizePath } from "./patterns.js";
import { inspectText, RULES } from "./rules.js";

const DEFAULT_INCLUDE = [
  "**/__snapshots__/**", "**/snapshots/**", "**/fixtures/**", "**/testdata/**",
  "**/*.snap", "**/*.golden", "**/*.fixture",
];
const DEFAULT_EXCLUDE = [
  ".git/**", "node_modules/**", "vendor/**", "dist/**", "build/**", "coverage/**",
  ".venv/**", "venv/**", "__pycache__/**",
];

export function validateConfig(input) {
  if (input === null || Array.isArray(input) || typeof input !== "object") throw new TypeError("Configuration must be an object.");
  const known = new Set(["$schema", "version", "include", "exclude", "disabledRules", "maxFileBytes", "baseline"]);
  const unknown = Object.keys(input).filter((key) => !known.has(key));
  if (unknown.length) throw new TypeError(`Unknown configuration field(s): ${unknown.join(", ")}.`);
  if (input.version !== 1) throw new TypeError("Configuration version must be 1.");
  for (const key of ["include", "exclude", "disabledRules"]) {
    if (key in input && (!Array.isArray(input[key]) || input[key].some((entry) => typeof entry !== "string"))) {
      throw new TypeError(`${key} must be an array of strings.`);
    }
  }
  const disabledRules = input.disabledRules ?? [];
  const ruleIds = new Set(RULES.map(({ id }) => id));
  const unknownRules = disabledRules.filter((rule) => !ruleIds.has(rule));
  if (unknownRules.length) throw new TypeError(`Unknown rule(s): ${unknownRules.join(", ")}.`);
  const maxFileBytes = input.maxFileBytes ?? 1_048_576;
  if (!Number.isInteger(maxFileBytes) || maxFileBytes < 1024 || maxFileBytes > 16_777_216) {
    throw new TypeError("maxFileBytes must be an integer between 1024 and 16777216.");
  }
  if (input.baseline !== undefined && (typeof input.baseline !== "string" || !input.baseline)) {
    throw new TypeError("baseline must be a non-empty string.");
  }
  return {
    version: 1,
    include: input.include ?? DEFAULT_INCLUDE,
    exclude: input.exclude ?? [],
    disabledRules,
    maxFileBytes,
    baseline: input.baseline ?? ".fixtureguard-baseline.json",
  };
}

export async function loadConfig(root, configPath) {
  const target = path.resolve(root, configPath ?? ".fixtureguard.json");
  try {
    const input = JSON.parse(await readFile(target, "utf8"));
    return validateConfig(input);
  } catch (error) {
    if (error?.code === "ENOENT" && configPath === undefined) return validateConfig({ version: 1 });
    if (error instanceof SyntaxError) throw new SyntaxError(`Invalid JSON in ${target}: ${error.message}`);
    throw error;
  }
}

async function walk(root, relativeDirectory, config, files) {
  const entries = await readdir(path.join(root, relativeDirectory), { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const relative = normalizePath(path.join(relativeDirectory, entry.name));
    const probe = entry.isDirectory() ? `${relative}/` : relative;
    if (matchesAny(probe, [...DEFAULT_EXCLUDE, ...config.exclude])) continue;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      await walk(root, relative, config, files);
      continue;
    }
    if (!entry.isFile() || !matchesAny(relative, config.include)) continue;
    const metadata = await stat(path.join(root, relative));
    if (metadata.size <= config.maxFileBytes) files.push(relative);
  }
}

async function loadBaseline(root, name) {
  const target = path.resolve(root, name);
  try {
    const input = JSON.parse(await readFile(target, "utf8"));
    if (input?.version !== 1 || !Array.isArray(input.fingerprints)
      || input.fingerprints.some((value) => typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))) {
      throw new TypeError(`Invalid baseline format: ${target}.`);
    }
    return new Set(input.fingerprints);
  } catch (error) {
    if (error?.code === "ENOENT") return new Set();
    if (error instanceof SyntaxError) throw new SyntaxError(`Invalid JSON in ${target}: ${error.message}`);
    throw error;
  }
}

export async function scanRepository(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const config = options.config ? validateConfig(options.config) : await loadConfig(root, options.configPath);
  const files = [];
  await walk(root, "", config, files);
  const baseline = options.ignoreBaseline ? new Set() : await loadBaseline(root, config.baseline);
  const allFindings = [];
  let binaryFilesSkipped = 0;
  for (const file of files) {
    const buffer = await readFile(path.join(root, file));
    if (buffer.includes(0)) {
      binaryFilesSkipped += 1;
      continue;
    }
    allFindings.push(...inspectText(file, buffer.toString("utf8"), config.disabledRules));
  }
  allFindings.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column || left.rule.localeCompare(right.rule));
  const findings = allFindings.filter(({ fingerprint }) => !baseline.has(fingerprint));
  return {
    schemaVersion: 1,
    root,
    filesScanned: files.length - binaryFilesSkipped,
    binaryFilesSkipped,
    suppressed: allFindings.length - findings.length,
    findings,
    allFindings,
    baselinePath: config.baseline,
  };
}
