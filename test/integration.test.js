import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scanRepository, validateConfig } from "../src/index.js";

async function repository() {
  const root = await mkdtemp(path.join(os.tmpdir(), "fixtureguard-"));
  await mkdir(path.join(root, "tests", "fixtures"), { recursive: true });
  await writeFile(path.join(root, "tests", "fixtures", "dirty.snap"), "workspace=/home/alice/project\npeer=10.2.3.4\n");
  await writeFile(path.join(root, "tests", "fixtures", "clean.snap"), "workspace=<WORKSPACE>\npeer=<PRIVATE_IP>\n");
  await writeFile(path.join(root, "tests", "fixtures", "binary.snap"), Buffer.from([0, 1, 2, 3]));
  return root;
}

test("repository scan is deterministic and skips binary fixture content", async () => {
  const root = await repository();
  const result = await scanRepository({ root });
  assert.deepEqual(result.findings.map(({ rule }) => rule), ["HOST002", "NET001"]);
  assert.equal(result.filesScanned, 2);
  assert.equal(result.binaryFilesSkipped, 1);
});

test("a value-free baseline suppresses exact existing findings", async () => {
  const root = await repository();
  const initial = await scanRepository({ root, ignoreBaseline: true });
  await writeFile(path.join(root, ".fixtureguard-baseline.json"), `${JSON.stringify({
    version: 1,
    fingerprints: [initial.findings[0].fingerprint],
  })}\n`);
  const result = await scanRepository({ root });
  assert.equal(result.suppressed, 1);
  assert.deepEqual(result.findings.map(({ rule }) => rule), ["NET001"]);
});

test("baseline fingerprints are scoped to the fixture path", async () => {
  const root = await repository();
  const initial = await scanRepository({ root, ignoreBaseline: true });
  await writeFile(path.join(root, ".fixtureguard-baseline.json"), `${JSON.stringify({
    version: 1,
    fingerprints: [initial.findings[0].fingerprint],
  })}\n`);
  await writeFile(path.join(root, "tests", "fixtures", "copy.snap"), "workspace=/home/alice/project\n");
  const result = await scanRepository({ root });
  assert.equal(result.findings.some(({ file, rule }) => file.endsWith("copy.snap") && rule === "HOST002"), true);
});

test("configuration rejects unknown rules and fields", () => {
  assert.throws(() => validateConfig({ version: 1, disabledRules: ["NOPE"] }), /Unknown rule/);
  assert.throws(() => validateConfig({ version: 1, mystery: true }), /Unknown configuration field/);
});
