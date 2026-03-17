# scopetrace

> Отслеживание владения ресурсами и поиск утечек в Node.js процессах

[English README](README.md)

**scopetrace** показывает не просто список «живых handle'ов», а полноценный **ownership trace**:

- какой ресурс все еще активен
- где он был создан, включая stack trace
- в каком бизнес-scope он был создан
- сколько времени он живет
- каким способом его предполагалось закрыть

## Зачем

[`why-is-node-running`](https://github.com/mafintosh/why-is-node-running) показывает стеки, но не бизнес-контекст.  
Флаг Jest `--detectOpenHandles` часто недостаточен для реальных проектов.  
`process.getActiveResourcesInfo()` показывает типы активных ресурсов, но не их владельцев.

`scopetrace` закрывает этот пробел с помощью **явного, scope-based отслеживания владения ресурсами**. Подход детерминированный, привязан к контексту и подходит для CI. Для быстрого первого прохода есть опциональный [zero-setup mode](#zero-setup-mode) без изменений в коде приложения.

## Статус

`v0.3.4` — основной публичный стек уже реализован: tracking, reporting, assertions и рабочие примеры.

| Этап | Статус           | Описание                                                         |
| ---- | ---------------- | ---------------------------------------------------------------- |
| 1    | ✅ Готово        | Foundation: `scope()` + AsyncLocalStorage                        |
| 2    | ✅ Готово        | Resource registry: статусы, IDs                                  |
| 3    | ✅ Готово        | Trackers: timeout / interval / server / disposable               |
| 4    | ✅ Готово        | Structured report + форматирование `pretty` / `compact` / `json` |
| 5    | ✅ Готово        | `assertNoLeaks()` с режимами strict / soft                       |
| 6    | ✅ Готово        | Integration examples                                             |
| 7    | 🔜 Запланировано | Hardening + v1.0.0                                               |

## Roadmap

| Версия | Цель                                 | Планируемый scope                                                                                                      |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| v0.1.x | Стабилизация foundation              | Довести `scope()`, сохранить per-instance isolation, улучшить документацию, проверить поведение в реальных приложениях |
| v0.2.0 | Первая полезная leak tracking версия | Resource registry, lifecycle statuses, `trackDisposable()`, `trackTimeout()`, `trackInterval()`, начальный `report()`  |
| v0.3.0 | Интеграция в тесты и сервисы         | `trackServer()`, `assertNoLeaks()`, compact output, примеры для `node:test`, Vitest, Jest                              |
| v0.4.0 | Удобство для разработчика            | Ignore rules, better stack formatting, graceful shutdown helper, richer summaries                                      |
| v1.0.0 | Стабильный публичный релиз           | API freeze, CI matrix, benchmarks, cleanup документации, npm publish                                                   |
| v1.1+  | Расширяемость                        | `trackAbortController()`, `trackImmediate()`, adapter API, optional plugins                                            |

### Текущий фокус

- Довести edge cases вокруг timer'ов и жизненного цикла server.
- Добавить CI matrix и benchmark coverage до `v1.0.0`.
- Расширить adapters и примеры.

### Что не входит в v1

- Глобальная auto-instrumentation через `async_hooks`
- Встроенные адаптеры для баз данных и message brokers
- Worker threads, `child_process` и широкое auto-detection для socket'ов
- Web UI или APM-подобная агрегация

## Требования

- Node.js `>= 20`
- ESM или CJS

## Установка

```bash
npm install scopetrace
```

## Использование

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

`report()` возвращает структурированный объект с summary и списком активных утечек. Для вывода в человекочитаемом виде или для CI используйте `formatPrettyReport()`, `formatCompactReport()`, `formatJsonReport()` или `formatReport()`.

## Graceful Shutdown Helper

Используйте shutdown helper, когда нужен переиспользуемый signal handler с cleanup, отчетом и exit code на основе результата shutdown.

```ts
import { createGracefulShutdown, createScopeTrace } from "scopetrace";

const st = createScopeTrace();
const heartbeat = st.trackInterval(
  setInterval(() => {}, 1_000),
  {
    label: "heartbeat",
  },
);

const shutdown = createGracefulShutdown(st, {
  cleanup: async () => {
    clearInterval(heartbeat);
    await new Promise((resolve) => setTimeout(resolve, 20));
  },
  format: "compact",
});

shutdown.install();
```

Контроллер предоставляет `install()`, `run(signal)` и `uninstall()`. `run()` удобен для тестов или ручной orchestration shutdown flow, а `install()` подписывает process на OS signals и завершает процесс с кодом `0` при чистом shutdown или `1`, если cleanup завершился ошибкой либо strict leak check обнаружил активные ресурсы.

## Zero-Setup Mode

Для быстрого онбординга и первого прохода диагностики есть best-effort preload mode.

Запуск приложения без изменений в коде:

```bash
node --import scopetrace/register app.mjs
npx scopetrace app.mjs
npx scopetrace src/app.ts
npx scopetrace --format compact --stack-frames 2 app.mjs
```

`scopetrace ...` — это небольшой wrapper вокруг preload mode. В `v0.3.x` он поддерживает только Node commands. Legacy-форма `scopetrace run node app.mjs` все еще работает, но короткая форма теперь основная.

TypeScript entry files (`.ts`, `.tsx`, `.mts`, `.cts`) поддерживаются из коробки через встроенный runtime `tsx`.

Если entry file только экспортирует функции или helpers и не выполняет код на top level, `scopetrace` может показать `total 0`, потому что за время жизни процесса не было создано ни одного tracked resource.

Короткий alias:

- `sctrace app.mjs`
- `sctrace src/app.ts`

Используйте `sctrace`, если пакет установлен локально или глобально. Для разового удаленного запуска оставьте `npx scopetrace ...` или `npm exec --package scopetrace sctrace ...`.

Опции CLI wrapper:

- `--format pretty|compact|json`
- `--stack-frames <number>`
- `--color | --no-color`
- `--timers | --no-timers`
- `--http | --no-http`
- `--https | --no-https`
- `--net | --no-net`

Полезные переменные окружения:

- `SCOPETRACE_FORMAT=pretty|compact|json`
- `SCOPETRACE_STACK_FRAMES=2`
- `SCOPETRACE_COLOR=0|1`
- `SCOPETRACE_REPORT_ON_EXIT=0|1`
- `SCOPETRACE_INCLUDE_TIMERS=0|1`
- `SCOPETRACE_INCLUDE_HTTP=0|1`
- `SCOPETRACE_INCLUDE_HTTPS=0|1`
- `SCOPETRACE_INCLUDE_NET=0|1`

Что он умеет auto-track:

- `setTimeout`
- `setInterval`
- `http.createServer()`
- `https.createServer()`
- `net.createServer()`

Что он не может надежно определить без явной интеграции:

- бизнес-scopes через `scope()`
- custom disposables
- точное ownership для произвольных ресурсов сторонних библиотек

Этот режим намеренно best-effort. Он полезен для первичного поиска утечек, а явная инструментализация остается точным режимом ownership tracing.

## Примеры

- `examples/http-server/index.mjs`
- `examples/graceful-shutdown/index.mjs`
- `examples/node-test/leak-check.test.mjs`
- `examples/mini-projects/good.mjs`
- `examples/mini-projects/bad.mjs`
- `examples/zero-setup/good-app.mjs`
- `examples/zero-setup/bad-app.mjs`
- `examples/mini-projects/good.ts`
- `examples/mini-projects/bad.ts`

### Готовые CLI fixtures

Запускать из корня репозитория:

```bash
npm run fixture:good
npm run fixture:bad
npm run fixture:zero-good
npm run fixture:zero-bad
npm run fixture:cli-zero-good
npm run fixture:cli-zero-bad
npm run fixture:cli-ts-good
npm run fixture:cli-ts-bad
```

Ожидаемое поведение:

- `fixture:good` печатает чистый отчет и завершает процесс с кодом `0`
- `fixture:bad` печатает утечки, затем выполняет cleanup и завершает процесс с кодом `1`
- `fixture:zero-good` запускает неинструментированное приложение через preload и завершается чисто
- `fixture:zero-bad` запускает неинструментированное приложение через preload и печатает best-effort leak report при выходе
- `fixture:cli-zero-good` запускает тот же zero-setup сценарий через CLI wrapper
- `fixture:cli-zero-bad` запускает тот же zero-setup сценарий через CLI wrapper
- `fixture:cli-ts-good` запускает good mini-project как TypeScript entry file через CLI wrapper
- `fixture:cli-ts-bad` запускает bad mini-project как TypeScript entry file через CLI wrapper и демонстрирует leak detection на `.ts` коде

## Release

См. [docs/release-checklist.md](docs/release-checklist.md) для чеклиста публикации.

## Принципы дизайна

- **Explicit over magic** — core API требует явного tracking; zero-setup mode остается опциональным быстрым режимом диагностики
- **Scope-based ownership** — каждый ресурс знает свой бизнес-контекст
- **CI-friendly** — structured JSON output для автоматизированных пайплайнов
- **TypeScript-first** — ESM + CJS, типы включены
- **Minimal runtime dependencies** — только `tsx` для встроенной поддержки TypeScript entry files

## Лицензия

MIT
