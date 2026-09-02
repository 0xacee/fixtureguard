import { RULES } from "./rules.js";

export function toSarif(result) {
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: { driver: {
        name: "FixtureGuard",
        informationUri: "https://github.com/0xacee/fixtureguard",
        semanticVersion: "0.1.0",
        rules: RULES.map((rule) => ({
          id: rule.id,
          name: rule.name,
          shortDescription: { text: rule.message },
          defaultConfiguration: { level: "error" },
        })),
      } },
      results: result.findings.map((finding) => ({
        ruleId: finding.rule,
        level: "error",
        message: { text: finding.message },
        partialFingerprints: { fixtureGuardFingerprint: finding.fingerprint },
        locations: [{ physicalLocation: {
          artifactLocation: { uri: finding.file.split("\\").join("/") },
          region: { startLine: finding.line, startColumn: finding.column },
        } }],
      })),
    }],
  };
}
