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

`scopetrace` fills the gap with **explicit, scope-based resource ownership tracking** — no auto-patching, no surprises.

## Status

`v0.3.0` — the main public stack is implemented: tracking, reporting, assertions, and runnable examples.

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
- Expand adapters and examples without introducing auto-magic.

### Out of scope for v1

- Global auto-instrumentation through `async_hooks`
- Deep monkey patching of Node built-ins
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

## Examples

- `examples/http-server/index.mjs`
- `examples/graceful-shutdown/index.mjs`
- `examples/node-test/leak-check.test.mjs`

## Release

See [docs/release-checklist.md](docs/release-checklist.md) for the publication checklist.

## Design Principles

- **Explicit over magic** — no auto-patching via `async_hooks` in v1
- **Scope-based ownership** — every resource knows its business context
- **CI-friendly** — structured JSON output for automated pipelines
- **TypeScript-first** — ESM + CJS, full types included
- **Zero runtime dependencies**

## Architecture

```
src/
  core/          createScopeTrace() factory
  context/       AsyncLocalStorage layer + scope graph
  registry/      tracked resource store (Phase 2+)
  trackers/      timeout / interval / server / disposable (Phase 3+)
  reporting/     pretty / json formatters (Phase 4+)
  assertion/     assertNoLeaks (Phase 5+)
  types/         public.ts + internal.ts
  errors.ts      ScopeTraceError hierarchy
```

## License

MIT
