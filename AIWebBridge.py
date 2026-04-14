import argparse
import json
import threading
import time
import uuid
from urllib import request

from AIAnalyzer import AIAnalyzer

TIMING_APIS = {
    "GetTickCount",
    "QueryPerformanceCounter",
    "GetSystemTimeAsFileTime",
}

CATEGORY_NORMALIZATION = {
    "Benigno": "Benigno",
    "Anti-Debugging (Timing)": "Anti-Debugging",
    "Anti-VM / Sandbox": "Anti-VM",
    "Injeção de Código / Process Hollowing": "Injeção de Código",
    "Ofuscação / Empacotamento (Packer)": "Ofuscação",
}

FUNCTION_CATEGORIES = {
    "IsDebuggerPresent": ("Anti-Debugging", "Verifica a presença de depurador no processo atual."),
    "CheckRemoteDebuggerPresent": ("Anti-Debugging", "Consulta se outro processo anexou um depurador."),
    "NtQueryInformationProcess": ("Anti-Debugging", "Lê metadados do processo, frequentemente usados para detectar análise."),
    "GetTickCount": ("Anti-Timing", "Consulta o tempo de atividade do sistema para loops de timing evasivos."),
    "QueryPerformanceCounter": ("Anti-Timing", "Usa contador de alta resolução para detectar overhead da instrumentação."),
    "GetSystemTimeAsFileTime": ("Anti-Timing", "Consulta o relógio do sistema para validar desvios temporais."),
    "VirtualProtect": ("Memory Manipulation", "Altera permissões de memória e pode sinalizar unpacking ou shellcode."),
    "VirtualAlloc": ("Memory Manipulation", "Reserva memória dinâmica potencialmente usada por payloads."),
    "LoadLibraryA": ("Dynamic Loading", "Carrega bibliotecas dinamicamente durante a execução."),
    "GetProcAddress": ("Dynamic Loading", "Resolve APIs dinamicamente para reduzir artefatos estáticos."),
}


class AIWebBridge:
    def __init__(self, dashboard_url: str, sample_name: str, session_key: str | None = None, pipe_name: str = "AIContradefPipe"):
        self.dashboard_url = dashboard_url.rstrip("/")
        self.sample_name = sample_name
        self.session_key = session_key or f"session-{uuid.uuid4().hex[:8]}"
        self.analyzer = AIAnalyzer(pipe_name=pipe_name)
        self.running = False
        self.last_processed_index = 0
        self.last_signature = None

    def _normalize_category(self, raw: str) -> str:
        return CATEGORY_NORMALIZATION.get(raw, raw)

    def _post(self, payload: dict):
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(
            f"{self.dashboard_url}/api/runtime/ingest",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=5) as response:
            response.read()

    def _build_log_payload(self, raw_parts: list[str]) -> dict:
        tid, start_time, function_name, module_name, duration_ticks = raw_parts[:5]
        category, description = FUNCTION_CATEGORIES.get(
            function_name,
            ("Execution Flow", "API observada durante a execução instrumentada."),
        )

        duration_value = float(duration_ticks)
        anomaly_reason = None
        anomaly_flag = False
        if function_name in TIMING_APIS and duration_value > 5000:
            anomaly_flag = True
            anomaly_reason = "Duração acima do limiar esperado para API de timing monitorada."

        return {
            "sessionKey": self.session_key,
            "sampleName": self.sample_name,
            "source": "AIAnalyzer.py",
            "status": "running",
            "log": {
                "TID": str(tid),
                "StartTime": str(start_time),
                "FunctionName": function_name,
                "ModuleName": module_name,
                "DurationTicks": str(duration_ticks),
                "category": category,
                "description": description,
                "anomalyFlag": anomaly_flag,
                "anomalyReason": anomaly_reason,
            },
        }

    def _build_detection_payload(self, result: dict) -> dict:
        classification = self._normalize_category(result["category"])
        severity = "critical" if classification in {"Anti-VM", "Injeção de Código"} else "high"
        rationale = "APIs suspeitas detectadas: " + ", ".join(result.get("suspicious_calls", [])) if result.get("suspicious_calls") else "Padrão comportamental suspeito identificado pelo modelo."

        payload = {
            "sessionKey": self.session_key,
            "sampleName": self.sample_name,
            "source": "AIAnalyzer.py",
            "status": "running",
            "detection": {
                "classification": classification,
                "confidence": round(float(result["confidence"]) * 100, 2),
                "rationale": rationale,
            },
        }

        if classification in {"Anti-VM", "Injeção de Código"}:
            payload["alert"] = {
                "title": f"Detecção de alta severidade: {classification}",
                "message": f"A sessão {self.session_key} apresentou indícios consistentes com {classification}.",
                "severity": severity,
                "classification": classification,
            }

        return payload

    def _dispatch_loop(self):
        while self.running:
            time.sleep(1)
            with self.analyzer.lock:
                pending = self.analyzer.data_buffer[self.last_processed_index:]
                self.last_processed_index = len(self.analyzer.data_buffer)

            for raw_parts in pending:
                try:
                    self._post(self._build_log_payload(raw_parts))
                except Exception as exc:
                    print(f"[AIWebBridge] Falha ao publicar log: {exc}")

            try:
                result = self.analyzer.analyze_realtime()
                if result:
                    signature = (result["category"], round(float(result["confidence"]), 4), result["total_calls"])
                    if signature != self.last_signature:
                        self.last_signature = signature
                        self._post(self._build_detection_payload(result))
            except Exception as exc:
                print(f"[AIWebBridge] Falha ao publicar detecção: {exc}")

    def start(self):
        self.running = True
        self.analyzer.start_pipe_server()
        print(f"[AIWebBridge] Sessão {self.session_key} conectada ao dashboard {self.dashboard_url}")
        self.worker = threading.Thread(target=self._dispatch_loop, daemon=True)
        self.worker.start()

    def stop(self):
        self.running = False
        self.analyzer.stop()


def main():
    parser = argparse.ArgumentParser(description="Encaminha eventos do AIAnalyzer.py para o dashboard web em tempo real.")
    parser.add_argument("--dashboard-url", default="http://localhost:3000", help="URL base da plataforma web local")
    parser.add_argument("--sample-name", default="target.exe", help="Nome lógico da amostra em análise")
    parser.add_argument("--session-key", default=None, help="Identificador da sessão no dashboard")
    parser.add_argument("--pipe-name", default="AIContradefPipe", help="Nome do pipe compartilhado com o módulo de instrumentação")
    args = parser.parse_args()

    bridge = AIWebBridge(
        dashboard_url=args.dashboard_url,
        sample_name=args.sample_name,
        session_key=args.session_key,
        pipe_name=args.pipe_name,
    )
    bridge.start()

    try:
        while True:
            time.sleep(2)
    except KeyboardInterrupt:
        bridge.stop()


if __name__ == "__main__":
    main()
