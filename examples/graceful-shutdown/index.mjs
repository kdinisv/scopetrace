import { createScopeTrace, formatCompactReport } from "scopetrace";

const st = createScopeTrace();
const heartbeat = st.trackInterval(setInterval(() => { }, 1_000), {
  label: "heartbeat",
});

process.on("SIGTERM", async () => {
  clearInterval(heartbeat);
  await new Promise((resolve) => setTimeout(resolve, 20));

  const report = st.report();
  console.log(formatCompactReport(report));
  st.assertNoLeaks({ mode: "strict" });
  process.exit(0);
});
