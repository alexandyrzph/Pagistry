// k6 load test — simulates the editor's autosave hot path.
//
// The editor PUTs the full block-tree JSON to /api/pages/:id on a debounce while
// the author works. This script reproduces that write-heavy pattern to find the
// point where p95 latency degrades. See docs/post-mortem.md for the findings.
//
// Usage:
//   BASE_URL=http://localhost:3000 \
//   PC_SESSION=<cookie> PAGE_ID=<id> \
//   k6 run scripts/load/k6-autosave.js
//
// Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const autosaveLatency = new Trend("autosave_latency_ms", true);

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const PAGE_ID = __ENV.PAGE_ID || "REPLACE_ME";
const SESSION = __ENV.PC_SESSION || "";

// Ramp profile: warm up, hold, then push past comfortable load.
export const options = {
  scenarios: {
    autosave: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "1m", target: 20 },
        { duration: "30s", target: 100 },
        { duration: "1m", target: 100 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<400"],
    http_req_failed: ["rate<0.01"],
  },
};

// A representative block tree (~40 blocks) similar to a real landing page.
function buildContent(n) {
  const blocks = [];
  for (let i = 0; i < n; i++) {
    blocks.push({
      id: `b-${i}-${Math.random().toString(36).slice(2, 8)}`,
      type: i % 3 === 0 ? "heading" : "text",
      props: { text: `Block ${i} — ` + "lorem ipsum dolor sit amet ".repeat(6) },
      styles: { desktop: { paddingTop: "16px", fontSize: "18px" } },
      children: [],
    });
  }
  return [{ id: "root-section", type: "section", props: {}, styles: {}, children: blocks }];
}

const PAYLOAD = JSON.stringify({ content: buildContent(40) });

export default function () {
  const res = http.put(`${BASE_URL}/api/pages/${PAGE_ID}`, PAYLOAD, {
    headers: { "Content-Type": "application/json", Cookie: `pc_session=${SESSION}` },
  });
  autosaveLatency.add(res.timings.duration);
  check(res, {
    "status is 200": (r) => r.status === 200,
    "has trace id": (r) => !!r.headers["X-Trace-Id"],
  });
  // Authors don't save continuously; ~1 save / 2s while actively editing.
  sleep(2);
}
