import { createHash } from "node:crypto";

export const RULES = Object.freeze([
  {
    id: "HOST001",
    name: "windows-user-home",
    message: "Windows user-profile path makes this fixture host-specific",
    expression: /\b[A-Za-z]:[\\/]Users[\\/][^\\/\s"'<>]+[\\/][^\s"'<>]*/gi,
  },
  {
    id: "HOST002",
    name: "linux-user-home",
    message: "Linux user-home path makes this fixture host-specific",
    expression: /\/home\/[^/\s"'<>]+\/[^\s"'<>]*/g,
  },
  {
    id: "HOST003",
    name: "macos-user-home",
    message: "macOS user-home path makes this fixture host-specific",
    expression: /\/Users\/[^/\s"'<>]+\/[^\s"'<>]*/g,
  },
  {
    id: "HOST004",
    name: "temporary-path",
    message: "Temporary path can change between machines or test runs",
    expression: /(?:\/(?:private\/)?tmp\/[^\s"'<>]+|[A-Za-z]:[\\/][^\r\n"'<>]*[\\/]AppData[\\/]Local[\\/]Temp[\\/][^\s"'<>]+)/gi,
  },
  {
    id: "HOST005",
    name: "runtime-user-directory",
    message: "Per-user runtime path embeds a machine-specific numeric user ID",
    expression: /\/run\/user\/\d+\/[^\s"'<>]*/g,
  },
  {
    id: "NONDET001",
    name: "process-path",
    message: "Process-specific /proc path embeds a nondeterministic PID",
    expression: /\/proc\/(?!self(?:\/|\b)|thread-self(?:\/|\b))\d+\/[^\s"'<>]*/g,
  },
  {
    id: "NET001",
    name: "private-ipv4",
    message: "Private-network address can expose or depend on local topology",
    expression: /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g,
  },
  {
    id: "NET002",
    name: "link-local-ipv4",
    message: "Link-local address is meaningful only on the producing host's network",
    expression: /\b169\.254(?:\.\d{1,3}){2}\b/g,
  },
]);

function locationAt(text, index) {
  const before = text.slice(0, index);
  const lines = before.split("\n");
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

function fingerprint(rule, file, match) {
  const normalized = match.toLowerCase().replaceAll("\\", "/");
  return createHash("sha256").update(`${rule.id}\0${file}\0${normalized}`).digest("hex");
}

export function inspectText(file, text, disabledRules = []) {
  const disabled = new Set(disabledRules);
  const findings = [];
  for (const rule of RULES) {
    if (disabled.has(rule.id)) continue;
    rule.expression.lastIndex = 0;
    for (const match of text.matchAll(rule.expression)) {
      const place = locationAt(text, match.index);
      findings.push({
        rule: rule.id,
        ruleName: rule.name,
        message: rule.message,
        file,
        ...place,
        fingerprint: fingerprint(rule, file, match[0]),
      });
    }
  }
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.rule}:${finding.file}:${finding.line}:${finding.column}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
