"""
End-to-End Verification Script for Clerk Authentication & Telemetry Ingestion.
"""
import urllib.request
import json
import jwt
import time
import sys

def verify_e2e():
    print("============================================================")
    print(" PRISON End-to-End Verification: Clerk Auth & Telemetry API")
    print("============================================================\n")

    # 1. Health check backend on port 8000
    print("[1/4] Checking FastAPI Backend Service (http://127.0.0.1:8000)...")
    try:
        res = urllib.request.urlopen("http://127.0.0.1:8000/health")
        health_data = json.loads(res.read().decode())
        print(f"      [OK] Status: {health_data.get('status')}")
    except Exception as e:
        print(f"      [FAIL] Backend service check failed: {e}")
        sys.exit(1)

    # 2. Check frontend web server on port 3000
    print("\n[2/4] Checking Web Frontend Application (http://localhost:3000)...")
    try:
        res = urllib.request.urlopen("http://localhost:3000")
        print(f"      [OK] HTTP Status Code: {res.status}")
    except Exception as e:
        print(f"      [FAIL] Web frontend check failed: {e}")
        sys.exit(1)

    # 3. Generate valid Clerk JWT session token
    print("\n[3/4] Simulating Valid Clerk JWT Session Token...")
    token_payload = {
        "sub": "user_2live_clerk_session_001",
        "iss": "https://clerk.prison.dev",
        "exp": int(time.time()) + 3600,
        "nbf": int(time.time()),
        "iat": int(time.time()),
        "sid": "sess_live_9988776655"
    }
    jwt_token = jwt.encode(token_payload, "clerk_secret_key_32_bytes_long_secret", algorithm="HS256")
    print(f"      [OK] Generated Bearer Token for User: '{token_payload['sub']}'")

    # 4. Send authenticated POST request to telemetry endpoint
    print("\n[4/4] Sending Authenticated POST /api/v1/telemetry/events...")
    telemetry_payload = {
        "sandbox_id": "sbx_live_test_001",
        "repo_name": "PRISON/PRISON",
        "pr_number": 42,
        "commit_sha": "a1b2c3d4e5f67890",
        "status": "RUNNING",
        "total_events": 1,
        "timestamp": 1700000000,
        "pid": 1234,
        "ppid": 1000,
        "comm": "curl",
        "syscall": "sys_enter_connect",
        "args": ["malicious-domain.com:443"],
        "honeypot_triggered": True
    }

    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/telemetry/events",
        data=json.dumps(telemetry_payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {jwt_token}"
        },
        method="POST"
    )

    try:
        response = urllib.request.urlopen(req)
        resp_data = json.loads(response.read().decode("utf-8"))
        print(f"      [OK] Response Status Code: {response.status}")
        print(f"      [OK] Response Body: {resp_data}")
        assert response.status in (200, 201)
        assert resp_data.get("status") == "INGESTED"
    except Exception as e:
        print(f"      [FAIL] Authenticated request failed: {e}")
        sys.exit(1)

    print("\n============================================================")
    print(" [SUCCESS] END-TO-END CLERK AUTHENTICATION VERIFICATION PASSED!")
    print("============================================================")

if __name__ == "__main__":
    verify_e2e()
