import assert from "node:assert/strict";
import test from "node:test";
import { toSarif } from "../src/sarif.js";

test("SARIF contains value-free diagnostics and stable fingerprints", () => {
  const secretPath = "/home/alice/private/file";
  const output = toSarif({ findings: [{
    rule: "HOST002",
    message: "Linux user-home path makes this fixture host-specific",
    file: "tests/fixture.snap",
    line: 3,
    column: 8,
    fingerprint: "a".repeat(64),
  }] });
  assert.equal(output.version, "2.1.0");
  assert.equal(output.runs[0].results[0].locations[0].physicalLocation.region.startLine, 3);
  assert.equal(JSON.stringify(output).includes(secretPath), false);
  assert.equal(output.runs[0].results[0].partialFingerprints.fixtureGuardFingerprint, "a".repeat(64));
});
