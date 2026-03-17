import { createGracefulShutdown, createScopeTrace } from "scopetrace";

const st = createScopeTrace();
const heartbeat = st.trackInterval(setInterval(() => { }, 1_000), {
  label: "heartbeat",
});

createGracefulShutdown(st, {
  cleanup: async () => {
    clearInterval(heartbeat);
    await new Promise((resolve) => setTimeout(resolve, 20));
  },
  format: "compact",
}).install();
