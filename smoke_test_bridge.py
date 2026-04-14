import json
import threading
import time
from pathlib import Path
from urllib.request import urlopen

from AIWebBridge import AIWebBridge

SESSION_KEY = "smoke-session"
DASHBOARD_URL = "http://127.0.0.1:3000"
PIPE_PATH = Path("/tmp/AIContradefPipe")


def wait_for_pipe(timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if PIPE_PATH.exists():
            return True
        time.sleep(0.1)
    return False


def emit_sample_logs():
    lines = [
        "1204,1000,GetTickCount,kernel32.dll,6100\n",
        "1204,1012,IsDebuggerPresent,kernel32.dll,33\n",
        "1204,1026,QueryPerformanceCounter,kernel32.dll,5800\n",
    ]
    with PIPE_PATH.open("w") as pipe:
        for line in lines:
            pipe.write(line)
            pipe.flush()
            time.sleep(0.2)


def load_snapshot_from_stream(timeout=10):
    with urlopen(f"{DASHBOARD_URL}/api/runtime/stream", timeout=timeout) as response:
        deadline = time.time() + timeout
        while time.time() < deadline:
            raw = response.readline().decode("utf-8", errors="ignore").strip()
            if not raw.startswith("data: "):
                continue
            try:
                payload = json.loads(raw[6:])
            except json.JSONDecodeError:
                continue

            snapshots = payload if isinstance(payload, list) else [payload]
            for snapshot in snapshots:
                if isinstance(snapshot, dict) and snapshot.get("sessionKey") == SESSION_KEY:
                    return snapshot
            break
    return None


def main():
    bridge = AIWebBridge(
        dashboard_url=DASHBOARD_URL,
        sample_name="smoke.exe",
        session_key=SESSION_KEY,
        pipe_name="AIContradefPipe",
    )
    bridge.start()

    try:
        if not wait_for_pipe():
            raise RuntimeError("Pipe do AIAnalyzer não foi criado a tempo.")

        writer = threading.Thread(target=emit_sample_logs, daemon=True)
        writer.start()
        writer.join(timeout=5)
        if writer.is_alive():
            raise RuntimeError("A escrita no pipe ficou bloqueada e não concluiu no tempo esperado.")

        deadline = time.time() + 8
        while time.time() < deadline and bridge.last_processed_index < 3:
            time.sleep(0.5)

        if bridge.last_processed_index < 3:
            raise RuntimeError(
                f"O bridge não processou todos os logs. last_processed_index={bridge.last_processed_index}, "
                f"buffer={bridge.analyzer.data_buffer}"
            )

        snapshot = None
        for _ in range(5):
            snapshot = load_snapshot_from_stream()
            if snapshot:
                break
            time.sleep(1)

        if not snapshot:
            raise RuntimeError("A sessão publicada pelo bridge não apareceu no bootstrap do stream do dashboard.")

        function_names = [log["FunctionName"] for log in snapshot.get("logs", [])]
        if "GetTickCount" not in function_names:
            raise RuntimeError("O evento GetTickCount não foi encaminhado ao dashboard.")

        print(json.dumps({
            "status": "ok",
            "sessionKey": SESSION_KEY,
            "functions": function_names,
            "classification": snapshot.get("latestDetection", {}).get("classification"),
        }, ensure_ascii=False))
    finally:
        bridge.stop()


if __name__ == "__main__":
    main()
