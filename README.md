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

`v0.1.0-dev` — Phase 1 foundation complete.

| Phase | Status     | Description                               |
| ----- | ---------- | ----------------------------------------- |
| 1     | ✅ Done    | Foundation: `scope()` + AsyncLocalStorage |
| 2     | 🔜 Next    | Resource registry (statuses, IDs)         |
| 3     | 🔜 Planned | Trackers: timeout / interval / server     |
| 4     | 🔜 Planned | Reporting: pretty / json / compact        |
| 5     | 🔜 Planned | `assertNoLeaks()` — CI and test hooks     |
| 6     | 🔜 Planned | Integration examples                      |
| 7     | 🔜 Planned | Hardening + v1.0.0                        |

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

- Finish the resource registry without retaining unnecessary strong references.
- Ship the first useful trackers for timers and custom disposables.
- Make `report()` actionable before adding broader integrations.

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

## Usage (v0.2+ API preview)

```ts
import { createScopeTrace } from "scopetrace";

const st = createScopeTrace();

// Wrap any operation in a named scope
await st.scope("request:POST /api/users", async () => {
  const server = http.createServer(handler);
  st.trackServer(server, {
    label: "api-server",
    expectedDispose: "server.close()",
  });

  const timer = setTimeout(() => {}, 5000);
  st.trackTimeout(timer, { label: "request-timeout" });

  // ... do work ...

  clearTimeout(timer);
  await closeServer(server);
});

// In afterAll / shutdown hook:
st.assertNoLeaks();
// Throws ScopeTraceAssertionError if anything leaked:
//
// ScopeTraceAssertionError: detected 1 leaked resource
//
//   - interval "heartbeat"
//     scope: bootstrap > redis-subscriber
//     age: 183244ms
//     expected dispose: subscriber.close()
//     created at:
//     src/infra/redis/subscriber.ts:42:17
```

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
