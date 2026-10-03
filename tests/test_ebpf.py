"""
Unit tests for eBPF Kernel Tracer and Event Dumper (`OSEN`).
"""

import tempfile
import os
import json
from services.ebpf.ebpf_tracer import EBPFTracer
from services.ebpf.event_dumper import EventDumper
from services.orchestrator.schemas import EventType


def test_ebpf_tracer_lifecycle():
    tracer = EBPFTracer("sbx_test_123")
    status = tracer.start_tracing()

    assert status.is_attached is True
    assert "sys_enter_execve" in status.active_probes

    tracer.generate_synthetic_telemetry(honeypot_triggered=True, decoy_name="AWS_SECRET_ACCESS_KEY")
    events = tracer.stop_tracing()

    assert len(events) == 5
    types = [e.event_type for e in events]
    assert EventType.EXECVE in types
    assert EventType.HONEYPOT_TRIGGER in types


def test_event_dumper():
    tracer = EBPFTracer("sbx_test_456")
    tracer.start_tracing()
    tracer.generate_synthetic_telemetry()
    events = tracer.stop_tracing()

    with tempfile.TemporaryDirectory() as tmpdir:
        dumper = EventDumper(output_dir=tmpdir)
        filepath = dumper.dump_events_to_file("sbx_test_456", events)

        assert os.path.exists(filepath)
        with open(filepath, "r") as f:
            data = json.load(f)
            assert data["sandbox_id"] == "sbx_test_456"
            assert len(data["events"]) == 4
