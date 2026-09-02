import assert from "node:assert/strict";
import test from "node:test";
import { inspectText } from "../src/rules.js";

test("detects host identity across Windows, Linux, and macOS paths", () => {
  const text = [
    "C:\\Users\\alice\\repo\\result.json",
    "/home/bob/project/output.txt",
    "/Users/carol/work/snapshot.txt",
  ].join("\n");
  assert.deepEqual(inspectText("fixture.snap", text).map(({ rule }) => rule), ["HOST001", "HOST002", "HOST003"]);
});

test("detects runtime, process, and network-local coordinates", () => {
  const text = "/run/user/1000/service.sock\n/proc/9182/fd/4\n192.168.4.20\n169.254.2.8\n";
  assert.deepEqual(inspectText("fixture.snap", text).map(({ rule }) => rule), [
    "HOST005", "NONDET001", "NET001", "NET002",
  ]);
});

test("allows stable proc aliases and public addresses", () => {
  const text = "/proc/self/status\n/proc/thread-self/fd/1\n8.8.8.8\n";
  assert.deepEqual(inspectText("fixture.snap", text), []);
});

test("findings expose coordinates and fingerprints but not matched values", () => {
  const secretPath = "/home/private-user/secret-project/output.txt";
  const finding = inspectText("fixture.snap", secretPath)[0];
  assert.equal(finding.line, 1);
  assert.equal(finding.column, 1);
  assert.match(finding.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(finding).includes(secretPath), false);
  assert.equal(JSON.stringify(finding).includes("private-user"), false);
});

test("rules can be disabled explicitly", () => {
  assert.deepEqual(inspectText("fixture.snap", "/home/alice/repo/file", ["HOST002"]), []);
});
