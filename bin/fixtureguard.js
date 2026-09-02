#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { scanRepository } from "../src/index.js";
import { RULES } from "../src/rules.js";
import { toSarif } from "../src/sarif.js";

const VERSION = "0.1.0";
const HELP = `FixtureGuard ${VERSION} — find host-specific data in committed test artifacts

Usage:
  fixtureguard check [options]
  fixtureguard baseline [options]
  fixtureguard init [options]
  fixtureguard rules

Options:
  --root <path>       repository root (default: current directory)
  --config <path>     config path relative to root
  --format <format>   text, json, or sarif (default: text)
  --force             allow baseline to replace its existing file
  -h, --help          show help
  -v, --version       show version
`;

function fail(message) {
  process.stderr.write(`fixtureguard: ${message}\n`);
  process.exitCode = 2;
}

function argumentsFrom(argv) {
  const options = { command: "check", root: process.cwd(), format: "text", force: false };
  let index = 0;
  if (argv[0] && !argv[0].startsWith("-")) {
    options.command = argv[0];
    index = 1;
  }
  for (; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root") options.root = argv[++index];
    else if (argument === "--config") options.configPath = argv[++index];
    else if (argument === "--format") options.format = argv[++index];
    else if (argument === "--force") options.force = true;
    else if (argument === "-h" || argument === "--help") options.help = true;
    else if (argument === "-v" || argument === "--version") options.version = true;
    else throw new Error(`unknown option: ${argument}`);
  }
  if (!["check", "baseline", "init", "rules"].includes(options.command)) throw new Error(`unknown command: ${options.command}`);
  if (!["text", "json", "sarif"].includes(options.format)) throw new Error("--format must be text, json, or sarif.");
  if (options.force && options.command !== "baseline") throw new Error("--force is valid only with baseline.");
  return options;
}

function publicResult(result) {
  const { allFindings, ...output } = result;
  return output;
}

function printText(result) {
  process.stdout.write(`FixtureGuard scanned ${result.filesScanned} text fixture${result.filesScanned === 1 ? "" : "s"}.\n`);
  for (const finding of result.findings) {
    process.stdout.write(`ERROR ${finding.rule}  ${finding.file}:${finding.line}:${finding.column}\n`);
    process.stdout.write(`      ${finding.message}\n`);
  }
  if (result.suppressed) process.stdout.write(`\n${result.suppressed} baseline finding${result.suppressed === 1 ? "" : "s"} suppressed.\n`);
  process.stdout.write(`\n${result.findings.length} unsuppressed finding${result.findings.length === 1 ? "" : "s"}\n`);
}

async function initialize(root) {
  const target = path.resolve(root, ".fixtureguard.json");
  const config = {
    $schema: "https://raw.githubusercontent.com/0xacee/fixtureguard/main/schemas/config.schema.json",
    version: 1,
    include: ["**/__snapshots__/**", "**/snapshots/**", "**/fixtures/**", "**/testdata/**", "**/*.snap", "**/*.golden", "**/*.fixture"],
    exclude: ["**/generated/**"],
    disabledRules: [],
    maxFileBytes: 1048576,
    baseline: ".fixtureguard-baseline.json",
  };
  await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  process.stdout.write(`Created ${target}\n`);
}

async function writeBaseline(options) {
  const result = await scanRepository({ ...options, ignoreBaseline: true });
  const target = path.resolve(result.root, result.baselinePath);
  const payload = {
    version: 1,
    fingerprints: [...new Set(result.allFindings.map(({ fingerprint }) => fingerprint))].sort(),
  };
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    flag: options.force ? "w" : "wx",
  });
  process.stdout.write(`Wrote ${payload.fingerprints.length} value-free fingerprint${payload.fingerprints.length === 1 ? "" : "s"} to ${target}\n`);
}

async function main() {
  let options;
  try {
    options = argumentsFrom(process.argv.slice(2));
  } catch (error) {
    fail(error.message);
    return;
  }
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  if (options.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  try {
    if (options.command === "init") return await initialize(options.root);
    if (options.command === "baseline") return await writeBaseline(options);
    if (options.command === "rules") {
      for (const rule of RULES) process.stdout.write(`${rule.id.padEnd(10)} ${rule.name}\n`);
      return;
    }
    const result = await scanRepository(options);
    if (options.format === "json") process.stdout.write(`${JSON.stringify(publicResult(result), null, 2)}\n`);
    else if (options.format === "sarif") process.stdout.write(`${JSON.stringify(toSarif(result), null, 2)}\n`);
    else printText(result);
    if (result.findings.length) process.exitCode = 1;
  } catch (error) {
    if (error?.code === "EEXIST") fail("target already exists; no file was changed.");
    else fail(error.message);
  }
}

await main();
