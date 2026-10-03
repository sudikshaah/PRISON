#!/usr/bin/env python3
"""
PRISON Deployment Readiness Verification Script
Runs E2E checks against the live backend on localhost:8000
Usage: python scripts/verify_deployment_readiness.py
"""

import sys
import time
import json
import urllib.request
import urllib.error

# Force UTF-8 output on Windows to avoid cp1252 encoding errors
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE = "http://localhost:8000"

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

results = []


def post(path, body):
    data = json.dumps(body).encode()
    req  = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    t0 = time.monotonic()
    with urllib.request.urlopen(req, timeout=60) as r:
        ms = int((time.monotonic() - t0) * 1000)
        return r.status, json.loads(r.read()), ms


def get(path):
    t0 = time.monotonic()
    with urllib.request.urlopen(f"{BASE}{path}", timeout=10) as r:
        ms = int((time.monotonic() - t0) * 1000)
        return r.status, json.loads(r.read()), ms


def check(name, passed, detail=""):
    symbol = f"{GREEN}✓{RESET}" if passed else f"{RED}✗{RESET}"
    status = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
    print(f"  {symbol}  {name:<55} [{status}]  {detail}")
    results.append((name, passed))


def section(title):
    print(f"\n{CYAN}{BOLD}{'-'*70}{RESET}")
    print(f"{CYAN}{BOLD}  {title}{RESET}")
    print(f"{CYAN}{BOLD}{'-'*70}{RESET}")


# ─────────────────────────────────────────────────────────────────────────────
section("SERVICE HEALTH CHECK")
try:
    status, body, ms = get("/health")
    check("Orchestrator /health returns 200", status == 200, f"{ms}ms")
    check("health.status == healthy", body.get("status") == "healthy")
except Exception as e:
    check("Orchestrator reachable at localhost:8000", False, str(e))
    print(f"\n{RED}  Backend is not running. Start it with:{RESET}")
    print(f"  cd services/orchestrator && uvicorn services.orchestrator.main:app --port 8000\n")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
section("SCENARIO A — Clean PR (no threat expected)")
try:
    code, data, ms = post("/api/v1/detonate", {"url": "https://github.com/tiangolo/fastapi/pull/11000"})
    check("HTTP 200 returned",                         code == 200,               f"{ms}ms")
    check("execution_id present",                      bool(data.get("execution_id")))
    check("terminal_logs non-empty",                   len(data.get("terminal_logs", [])) > 0)
    sev = data.get("severity", -1)
    check("severity field present",                    sev >= 0,                  f"severity={sev}")
    print(f"      {YELLOW}ℹ  Clean repo — severity {sev}/100{RESET}")
except Exception as e:
    check("Scenario A detonation", False, str(e))

# ─────────────────────────────────────────────────────────────────────────────
section("SCENARIO B — Local Malicious Demo Repo")
import os
demo_path = os.path.join(os.path.dirname(__file__), "..", "demo-repos", "scenario-b-malicious")
demo_path = os.path.normpath(demo_path)
if os.path.isdir(demo_path):
    try:
        code, data, ms = post("/api/v1/detonate", {"url": demo_path})
        check("HTTP 200 returned",                     code == 200,               f"{ms}ms")
        check("execution_id present",                  bool(data.get("execution_id")))
        sev = data.get("severity", 0)
        check("severity > 50 for malicious repo",      sev > 50,                  f"severity={sev}")
        has_patch = bool((data.get("patch_diff") or "").strip())
        check("PATCH_AVAILABLE: patch_diff non-empty", has_patch)
        check("terminal_logs contain ANAKIN line",
              any("ANAKIN" in l.get("msg","") for l in data.get("terminal_logs",[])))
        print(f"      {YELLOW}ℹ  Severity {sev}/100 | patch={has_patch}{RESET}")
    except Exception as e:
        check("Scenario B detonation", False, str(e))
else:
    print(f"  {YELLOW}⚠  demo-repos/scenario-b-malicious not found at {demo_path} — skipping{RESET}")

# ─────────────────────────────────────────────────────────────────────────────
section("SCENARIO C — Public GitHub PR (f/prompts.chat#1273)")
try:
    code, data, ms = post(
        "/api/v1/detonate",
        {"url": "https://github.com/f/prompts.chat/pull/1273"}
    )
    check("HTTP 200 returned",                         code == 200,               f"{ms}ms")
    check("execution_id present",                      bool(data.get("execution_id")))
    check("terminal_logs non-empty",                   len(data.get("terminal_logs", [])) > 0)
    check("No unhandled 500 / status field present",   "execution_id" in data)
    mode = data.get("execution_mode", "DYNAMIC")
    sev  = data.get("severity", 0)
    print(f"      {YELLOW}ℹ  Mode: {mode} | severity={sev}{RESET}")
except urllib.error.HTTPError as e:
    check("Scenario C — no HTTP 500", False, f"HTTP {e.code}")
except Exception as e:
    check("Scenario C detonation", False, str(e))

# ─────────────────────────────────────────────────────────────────────────────
section("SECURITY & CONFIG GUARDRAILS")
import pathlib
root = pathlib.Path(__file__).parent.parent

gitignore = root / ".gitignore"
if gitignore.exists():
    content = gitignore.read_text()
    check(".env listed in .gitignore",     ".env" in content)
    check("*.pem listed in .gitignore",    ".pem" in content or "*.pem" in content)
else:
    check(".gitignore exists",             False)

env_example = root / ".env.example"
if env_example.exists():
    ex = env_example.read_text()
    for var in ["GITHUB_TOKEN", "DEEPSEEK_API_KEY", "OPENAI_API_KEY", "DATABASE_URL"]:
        check(f".env.example contains {var}",  var in ex)
else:
    check(".env.example exists",           False)

# ─────────────────────────────────────────────────────────────────────────────
section("FINAL RESULTS")
passed = sum(1 for _, ok in results if ok)
total  = len(results)
pct    = int(passed / total * 100) if total else 0
colour = GREEN if pct == 100 else (YELLOW if pct >= 70 else RED)
print(f"\n  {colour}{BOLD}{passed}/{total} checks passed ({pct}%){RESET}\n")

for name, ok in results:
    mark = f"{GREEN}✓{RESET}" if ok else f"{RED}✗{RESET}"
    print(f"  {mark}  {name}")

print()
sys.exit(0 if pct == 100 else 1)
