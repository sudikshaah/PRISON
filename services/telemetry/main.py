"""
PRISON Telemetry & eBPF Event Ingestion Service (`TRACECOMMON` Track).
Exposed on port 8000/8001.
"""

from fastapi import FastAPI, status, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import asyncio

from services.telemetry.schemas.events import RawEbpfEvent
from services.telemetry.pipeline.normalizer import EventNormalizer
from services.telemetry.pipeline.dag_builder import DAGBuilder
from services.agent.triage.engine import AnakinTriageEngine
from services.telemetry.auth import get_current_user

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="PRISON Telemetry & eBPF Service",
    description="TRACECOMMON Telemetry Pipeline & Event Aggregator",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory telemetry log store
telemetry_store: List[Dict[str, Any]] = []


class TelemetryEventPayload(BaseModel):
    sandbox_id: str
    repo_name: str
    pr_number: int
    commit_sha: str
    status: str
    total_events: int
    events: List[Dict[str, Any]] = []
    honeypot_triggered: bool = False
    triggered_decoy: Optional[str] = None


@app.get("/")
def read_root():
    return {
        "service": "PRISON Telemetry & eBPF Engine",
        "status": "ONLINE",
        "track": "TRACECOMMON"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


engine = AnakinTriageEngine()


async def process_telemetry_background(payload: TelemetryEventPayload):
    builder = DAGBuilder(execution_id=payload.sandbox_id)
    for ev_dict in payload.events:
        event_type = ev_dict.get("event_type", "OTHER").lower()
        if event_type == "execve":
            syscall = "sys_enter_execve"
        elif event_type == "connect":
            syscall = "sys_enter_connect"
        elif event_type == "openat":
            syscall = "sys_enter_openat"
        else:
            syscall = "sys_other"

        raw = RawEbpfEvent(
            execution_id=payload.sandbox_id,
            pid=ev_dict.get("pid", 0),
            ppid=ev_dict.get("ppid", 0),
            comm=ev_dict.get("comm", "unknown"),
            syscall=syscall,
            args=ev_dict.get("details", {}),
            honeypot_key=ev_dict.get("details", {}).get("honeypot_key", None)
        )
        norm = EventNormalizer.normalize(raw)
        builder.add_event(norm)

    dag = builder.build()
    report = await engine.evaluate_dag(dag)
    return report


@app.post("/api/v1/telemetry/events", status_code=status.HTTP_201_CREATED)
def ingest_telemetry(
    payload: TelemetryEventPayload,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user)
):
    event_data = payload.model_dump()
    event_data["ingested_by_user"] = user_id
    telemetry_store.append(event_data)
    background_tasks.add_task(process_telemetry_background, payload)
    return {
        "status": "INGESTED",
        "sandbox_id": payload.sandbox_id,
        "event_count": payload.total_events
    }


@app.get("/api/v1/telemetry/events")
def get_telemetry_events(user_id: str = Depends(get_current_user)):
    return {
        "count": len(telemetry_store),
        "telemetry": telemetry_store
    }
