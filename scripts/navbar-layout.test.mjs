import assert from "node:assert/strict";
import test from "node:test";

import { needsCompactNavbar } from "../src/lib/navigation/navbarLayout.mjs";

test("navbar switches to compact layout exactly when its content runs out of room", () => {
  const fits = {
    viewportWidth: 1512,
    logoRight: 250,
    firstNavLeft: 420,
    lastNavRight: 1040,
    actionsLeft: 1060,
  };

  assert.equal(needsCompactNavbar(fits), false);
  assert.equal(
    needsCompactNavbar({ ...fits, lastNavRight: fits.actionsLeft }),
    true,
  );
  assert.equal(
    needsCompactNavbar({ ...fits, firstNavLeft: fits.logoRight }),
    true,
  );
  assert.equal(needsCompactNavbar({ ...fits, viewportWidth: 1023 }), true);
});
