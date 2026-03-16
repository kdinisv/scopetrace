import test from "node:test";
import assert from "node:assert/strict";
import { createScopeTrace } from "scopetrace";

test("tracked disposable is cleaned up", async () => {
  const st = createScopeTrace();
  const resource = { disposed: false };

  await st.scope("node:test", async () => {
    st.trackDisposable(resource, (value) => {
      value.disposed = true;
    }, {
      label: "fixture",
    });
  });

  const id = st.getTrackedId(resource);
  assert.ok(id);
  await st.disposeTracked(id);
  st.assertNoLeaks();
  assert.equal(resource.disposed, true);
});
