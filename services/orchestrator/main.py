"""
PRISON Core Engine FastAPI Application.
Main entry point for Orchestrator service.
"""
import time
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
)

from services.orchestrator.webhook_router import router as webhook_router
from services.agent.router import router as agent_router
from services.orchestrator.detonate_router import router as detonate_router

app = FastAPI(
    title="PRISON Core Engine",
    description="Pull Request Isolation & Security Observation Network Core detonate engine API",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://prison-1-pbsy.onrender.com",
        "https://prison.vercel.app"
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def request_logger(request: Request, call_next):
    t0 = time.monotonic()
    response = await call_next(request)
    ms = int((time.monotonic() - t0) * 1000)
    colour = "\033[32m" if response.status_code < 400 else "\033[31m"
    print(
        f"{colour}[{response.status_code}]\033[0m "
        f"{request.method} {request.url.path} — {ms}ms"
    )
    return response


app.include_router(webhook_router)
app.include_router(agent_router)
app.include_router(detonate_router)


@app.get("/")
def read_root():
    return {
        "service": "PRISON Engine Core",
        "status": "ONLINE",
        "tracks": ["MANTITUP (Isolation & Honeypots)", "OSEN (Kernel Observability)", "GitHub Ingestion Engine"]
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
