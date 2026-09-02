# Contributing

1. Describe the host-dependent artifact and why it is high-confidence.
2. Add synthetic positive and negative fixtures.
3. Prove diagnostics do not reproduce the matched value.
4. Run `npm run check` and dogfood `examples/`.

New rules should remain narrow. Prefer a false negative over a noisy pattern
that trains maintainers to disable the tool.
