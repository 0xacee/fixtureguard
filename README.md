# FixtureGuard

[![CI](https://github.com/0xacee/fixtureguard/actions/workflows/ci.yml/badge.svg)](https://github.com/0xacee/fixtureguard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-e11d48.svg)](LICENSE)

**Keep snapshots portable without printing the data that made them unsafe.**

FixtureGuard finds host-specific paths, process IDs, and local-network
addresses in committed fixtures and snapshots. Diagnostics report only the
rule and source coordinate—never the matched path, username, or address.

```text
$ npx github:0xacee/fixtureguard check
FixtureGuard scanned 18 text fixtures.
ERROR HOST002  tests/__snapshots__/doctor.snap:14:11
      Linux user-home path makes this fixture host-specific
ERROR NET001   testdata/discovery.golden:8:7
      Private-network address can expose or depend on local topology

2 unsuppressed findings
```

## Why fixture hygiene matters

A snapshot can pass on its author's laptop while failing on Windows, another
username, a CI runner, or the next process ID. It can also publish private
machine and network details as ordinary test data. FixtureGuard catches those
leaks before review without becoming a general secret scanner.

## Quick start

Node.js 20 or newer is the only requirement.

```bash
npx github:0xacee/fixtureguard check
npx github:0xacee/fixtureguard init
npx github:0xacee/fixtureguard check --format sarif > fixtureguard.sarif
```

Default discovery includes `fixtures`, `testdata`, `snapshots`,
`__snapshots__`, and files ending in `.snap`, `.golden`, or `.fixture`.
Dependencies, build output, virtual environments, symlinks, binary files, and
files over 1 MiB are skipped by default.

## Rules

| Rule | Detects |
| --- | --- |
| `HOST001` | Windows paths under a concrete `C:\\Users\\name` |
| `HOST002` | Linux paths under `/home/name` |
| `HOST003` | macOS paths under `/Users/name` |
| `HOST004` | Unix and Windows temporary paths |
| `HOST005` | `/run/user/<uid>` runtime paths |
| `NONDET001` | numeric `/proc/<pid>` paths; stable `self` aliases are allowed |
| `NET001` | RFC 1918-style private IPv4 ranges |
| `NET002` | IPv4 link-local addresses |

Run `fixtureguard rules` for the installed rule set.

## Configuration

```json
{
  "$schema": "https://raw.githubusercontent.com/0xacee/fixtureguard/main/schemas/config.schema.json",
  "version": 1,
  "include": ["tests/**", "packages/*/testdata/**"],
  "exclude": ["**/generated/**"],
  "disabledRules": [],
  "maxFileBytes": 1048576,
  "baseline": ".fixtureguard-baseline.json"
}
```

Disabling a rule is an explicit repository-wide decision. Prefer normalizing
fixtures to placeholders such as `<WORKSPACE>` and `<PRIVATE_IP>`.

## Ratcheting an existing repository

```bash
fixtureguard baseline
git add .fixtureguard-baseline.json
```

The baseline stores SHA-256 fingerprints scoped to rule, fixture path, and
normalized match. It contains no raw usernames, paths, or addresses. Existing
findings are suppressed while the same value in a new fixture still fails.
Baseline creation refuses replacement; `baseline --force` is required to
refresh it deliberately.

## Reports and exit codes

Text, deterministic JSON, and SARIF 2.1.0 are available. SARIF includes source
coordinates and value-free partial fingerprints for code-scanning systems.

| Code | Meaning |
| ---: | --- |
| `0` | no unsuppressed findings |
| `1` | host-specific fixture data found |
| `2` | usage, configuration, baseline, or I/O error |

## Boundaries

FixtureGuard is not a credentials scanner, malware detector, or proof that a
test is hermetic. It flags a narrow, high-confidence set of machine-dependent
artifacts and intentionally avoids printing the sensitive match.

## License

MIT
