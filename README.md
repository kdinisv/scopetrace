# scopetrace

> Track resource ownership and detect leaks in Node.js processes

**scopetrace** gives you not just a list of "alive handles" — it gives you an **ownership trace**:

- which resource is still alive
- where it was created (stack trace)
- in which named business scope it was created
- how long it has been alive
- how it was expected to be closed

## Why

[`why-is-node-running`](https://github.com/mafintosh/why-is-node-running) shows stacks but not business context.  
Jest's `--detectOpenHandles` is frequently insufficient for real projects.  
`process.getActiveResourcesInfo()` shows types but not owners.

`scopetrace` fills the gap with **explicit, scope-based resource ownership tracking** — deterministic, scope-aware, and CI-friendly. An optional [zero-setup mode](#zero-setup-mode) is available for quick first-pass diagnostics without code changes.

## Status

`v0.3.2` — the main public stack is implemented: tracking, reporting, assertions, and runnable examples.

| Phase | Status     | Description                                                  |
| ----- | ---------- | ------------------------------------------------------------ |
| 1     | ✅ Done    | Foundation: `scope()` + AsyncLocalStorage                    |
| 2     | ✅ Done    | Resource registry (statuses, IDs)                            |
| 3     | ✅ Done    | Trackers: timeout / interval / server / disposable           |
| 4     | ✅ Done    | Structured report + `pretty` / `compact` / `json` formatting |
| 5     | ✅ Done    | `assertNoLeaks()` with strict / soft modes                   |
| 6     | ✅ Done    | Integration examples                                         |
| 7     | 🔜 Planned | Hardening + v1.0.0                                           |

## Roadmap

| Milestone | Goal                         | Planned scope                                                                                                       |
| --------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| v0.1.x    | Stabilize foundation         | Harden `scope()`, keep per-instance isolation, improve docs, verify behavior in real apps                           |
| v0.2.0    | First real leak tracking     | Resource registry, lifecycle statuses, `trackDisposable()`, `trackTimeout()`, `trackInterval()`, initial `report()` |
| v0.3.0    | Test and service integration | `trackServer()`, `assertNoLeaks()`, compact output, examples for `node:test`, Vitest, Jest                          |
| v0.4.0    | Developer ergonomics         | Ignore rules, better stack formatting, graceful shutdown helper, richer summaries                                   |
| v1.0.0    | Stable public release        | API freeze, CI matrix, benchmarks, docs cleanup, npm publish                                                        |
| v1.1+     | Extensibility                | `trackAbortController()`, `trackImmediate()`, adapter API, optional plugins                                         |

### Current focus

- Harden edge cases around timers and server lifecycle.
- Add CI matrix and benchmark coverage before `v1.0.0`.
- Expand adapters and examples.

### Out of scope for v1

- Global auto-instrumentation through `async_hooks`
- Built-in adapters for databases and message brokers
- Worker threads, `child_process`, and broad socket auto-detection
- Web UI or APM-style aggregation

## Requirements

- Node.js `>= 20`
- ESM or CJS

## Installation

```bash
npm install scopetrace
```

## Usage

```ts
import { createScopeTrace, formatCompactReport } from "scopetrace";

const st = createScopeTrace();

await st.scope("bootstrap", async () => {
  const heartbeat = st.trackInterval(
    setInterval(() => {}, 1000),
    {
      label: "heartbeat",
    },
  );

  const disposable = st.trackDisposable(
    { closed: false },
    (resource) => {
      resource.closed = true;
    },
    {
      label: "job-resource",
      expectedDispose: "disposeTracked(id)",
    },
  );

  const reportBeforeDispose = st.report();
  console.log(reportBeforeDispose.summary);

  clearInterval(heartbeat);

  const disposableId = st.getTrackedId(disposable);

  if (disposableId !== undefined) {
    await st.disposeTracked(disposableId);
  }

  console.log(disposable.closed);
});

st.assertNoLeaks();

const report = st.report();
console.log(formatCompactReport(report));
```

`report()` returns a structured object with summary counts and active leaks. To render it for humans or CI logs, use `formatPrettyReport()`, `formatCompactReport()`, `formatJsonReport()`, or `formatReport()`.

## Zero-Setup Mode

For quick onboarding and first-pass diagnostics, there is a best-effort preload mode.

Run your app without changing its code:

```bash
node --import scopetrace/register app.mjs
npx scopetrace app.mjs
npx scopetrace src/app.ts
npx scopetrace --format compact --stack-frames 2 app.mjs
```

`scopetrace ...` is a small wrapper around the preload mode. In `v0.3.x` it supports Node commands only. The legacy form `scopetrace run node app.mjs` still works, but the short form is now the default.

TypeScript entry files (`.ts`, `.tsx`, `.mts`, `.cts`) are supported out of the box through the built-in `tsx` runtime.

If the entry file only exports functions or helpers and does not execute code at top level, `scopetrace` may report `total 0` because no tracked resources were created during process lifetime.

Short alias:

- `sctrace app.mjs`
- `sctrace src/app.ts`

Use `sctrace` when the package is installed locally or globally. For one-off remote execution, keep using `npx scopetrace ...` or `npm exec --package scopetrace sctrace ...`.

CLI wrapper options:

- `--format pretty|compact|json`
- `--stack-frames <number>`
- `--color | --no-color`
- `--timers | --no-timers`
- `--http | --no-http`
- `--https | --no-https`
- `--net | --no-net`

Useful environment variables:

- `SCOPETRACE_FORMAT=pretty|compact|json`
- `SCOPETRACE_STACK_FRAMES=2`
- `SCOPETRACE_COLOR=0|1`
- `SCOPETRACE_REPORT_ON_EXIT=0|1`
- `SCOPETRACE_INCLUDE_TIMERS=0|1`
- `SCOPETRACE_INCLUDE_HTTP=0|1`
- `SCOPETRACE_INCLUDE_HTTPS=0|1`
- `SCOPETRACE_INCLUDE_NET=0|1`

What it can auto-track:

- `setTimeout`
- `setInterval`
- `http.createServer()`
- `https.createServer()`
- `net.createServer()`

What it cannot do reliably without explicit integration:

- business scopes via `scope()`
- custom disposables
- precise ownership for arbitrary library resources

This mode is intentionally best-effort. It is useful for initial leak discovery, while explicit instrumentation remains the accurate mode for ownership tracing.

## Examples

- `examples/http-server/index.mjs`
- `examples/graceful-shutdown/index.mjs`
- `examples/node-test/leak-check.test.mjs`
- `examples/mini-projects/good.mjs`
- `examples/mini-projects/bad.mjs`
- `examples/zero-setup/good-app.mjs`
- `examples/zero-setup/bad-app.mjs`

### Runnable CLI fixtures

Run these from the repository root:

```bash
npm run fixture:good
npm run fixture:bad
npm run fixture:zero-good
npm run fixture:zero-bad
npm run fixture:cli-zero-good
npm run fixture:cli-zero-bad
```

Expected behavior:

- `fixture:good` prints a clean report and exits with code `0`
- `fixture:bad` prints leaked resources, then performs cleanup and exits with code `1`
- `fixture:zero-good` runs a non-instrumented app through the preload and exits cleanly
- `fixture:zero-bad` runs a non-instrumented app through the preload and prints a best-effort leak report on exit
- `fixture:cli-zero-good` runs the same zero-setup scenario via the CLI wrapper
- `fixture:cli-zero-bad` runs the same zero-setup scenario via the CLI wrapper

## Release

See [docs/release-checklist.md](docs/release-checklist.md) for the publication checklist.

## Design Principles

- **Explicit over magic** — core API requires explicit tracking; optional zero-setup mode for quick diagnostics
- **Scope-based ownership** — every resource knows its business context
- **CI-friendly** — structured JSON output for automated pipelines
- **TypeScript-first** — ESM + CJS, full types included
- **Minimal runtime dependencies** — only `tsx` for built-in TypeScript entry support

## License

MIT
