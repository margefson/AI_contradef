import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import {
  addAlert,
  addDetection,
  addFunctionEvent,
  buildSessionExport,
  ensureAnalysisSession,
  getSessionBundle,
  listAnalysisSessions,
  saveSessionReport,
  updateAnalysisSessionStatus,
} from "./db";
import type { DetectionClass } from "../drizzle/schema";

export type RuntimeLog = {
  TID: string;
  StartTime: string;
  FunctionName: string;
  ModuleName: string;
  DurationTicks: string;
  category?: string;
  description?: string;
  anomalyFlag?: boolean;
  anomalyReason?: string | null;
};

export type RuntimeDetection = {
  classification: DetectionClass;
  confidence: number;
  rationale?: string;
};

export type RuntimeAlert = {
  title: string;
  message: string;
  severity: "info" | "medium" | "high" | "critical";
  classification: DetectionClass;
};

export type RuntimeIngestPayload = {
  sessionKey: string;
  sampleName: string;
  source?: string;
  status?: "idle" | "running" | "completed" | "failed";
  log?: RuntimeLog;
  detection?: RuntimeDetection;
  alert?: RuntimeAlert;
  narrativeReport?: string;
};

export type RuntimeFunctionSummary = {
  FunctionName: string;
  Count: number;
  Category: string;
  Description: string;
};

export type RuntimeFlowEdge = {
  from: string;
  to: string;
  category: string;
  count: number;
};

export type RuntimeSnapshot = {
  sessionKey: string;
  sampleName: string;
  status: string;
  latestClassification: DetectionClass;
  latestConfidence: number;
  logs: RuntimeLog[];
  detections: RuntimeDetection[];
  alerts: RuntimeAlert[];
  functionTable: RuntimeFunctionSummary[];
  flowEdges: RuntimeFlowEdge[];
  narrativeReport: string | null;
  updatedAt: string;
};

type Subscriber = (event: {
  type: string;
  payload: RuntimeSnapshot | { sessionKey: string } | null;
}) => void;

const HIGH_SEVERITY_CLASSES = new Set<DetectionClass>(["Anti-VM", "Injeção de Código"]);
const TIMING_FUNCTIONS = new Set([
  "GetTickCount",
  "QueryPerformanceCounter",
  "GetSystemTimeAsFileTime",
]);
const MAX_LOG_BUFFER = 250;

function normalizeCategory(log: RuntimeLog): string {
  if (log.category?.trim()) return log.category;

  const name = log.FunctionName;
  if (["IsDebuggerPresent", "CheckRemoteDebuggerPresent", "NtQueryInformationProcess"].includes(name)) {
    return "Anti-Debugging";
  }
  if (TIMING_FUNCTIONS.has(name)) {
    return "Anti-Timing";
  }
  if (["VirtualAlloc", "VirtualProtect", "WriteProcessMemory", "ReadProcessMemory"].includes(name)) {
    return "Memory Manipulation";
  }
  if (["LoadLibraryA", "LoadLibraryW", "GetProcAddress"].includes(name)) {
    return "Dynamic Loading";
  }
  return "Execution Flow";
}

function normalizeDescription(log: RuntimeLog): string {
  if (log.description?.trim()) return log.description;

  const map: Record<string, string> = {
    GetTickCount: "Consulta o tempo de atividade do sistema em milissegundos e pode ser usada em rotinas anti-timing.",
    QueryPerformanceCounter: "Obtém um contador de alta resolução e costuma ser usada para detectar overhead ou sandbox.",
    GetSystemTimeAsFileTime: "Lê o relógio do sistema em formato FILETIME para validar desvios temporais durante a análise.",
    IsDebuggerPresent: "Verifica se há depurador anexado ao processo atual.",
    VirtualProtect: "Altera permissões de memória e pode indicar unpacking ou preparação para injeção.",
    LoadLibraryA: "Carrega DLLs dinamicamente em tempo de execução.",
    GetProcAddress: "Resolve endereços de APIs dinamicamente, frequentemente usado para evasão e ofuscação.",
  };

  return map[log.FunctionName] ?? "API observada durante a execução do malware.";
}

function buildFunctionTable(logs: RuntimeLog[]): RuntimeFunctionSummary[] {
  const grouped = new Map<string, RuntimeFunctionSummary>();

  for (const log of logs) {
    const current = grouped.get(log.FunctionName);
    if (current) {
      current.Count += 1;
      continue;
    }

    grouped.set(log.FunctionName, {
      FunctionName: log.FunctionName,
      Count: 1,
      Category: normalizeCategory(log),
      Description: normalizeDescription(log),
    });
  }

  return Array.from(grouped.values()).sort((a, b) => b.Count - a.Count);
}

function buildFlowEdges(logs: RuntimeLog[]): RuntimeFlowEdge[] {
  const grouped = new Map<string, RuntimeFlowEdge>();

  for (let i = 0; i < logs.length - 1; i += 1) {
    const from = logs[i];
    const to = logs[i + 1];
    const key = `${from.FunctionName}->${to.FunctionName}`;
    const current = grouped.get(key);

    if (current) {
      current.count += 1;
      continue;
    }

    grouped.set(key, {
      from: from.FunctionName,
      to: to.FunctionName,
      category: normalizeCategory(to),
      count: 1,
    });
  }

  return Array.from(grouped.values()).sort((a, b) => b.count - a.count).slice(0, 24);
}

class RuntimeService {
  private subscribers = new Set<Subscriber>();
  private snapshots = new Map<string, RuntimeSnapshot>();

  subscribe(subscriber: Subscriber) {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  getSnapshots() {
    return Array.from(this.snapshots.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }

  getSnapshot(sessionKey: string) {
    return this.snapshots.get(sessionKey) ?? null;
  }

  private emit(type: string, payload: RuntimeSnapshot | { sessionKey: string } | null) {
    for (const subscriber of Array.from(this.subscribers)) {
      subscriber({ type, payload });
    }
  }

  private async ensureSnapshot(sessionKey: string, sampleName: string, source?: string) {
    const existing = this.snapshots.get(sessionKey);
    if (existing) return existing;

    const session = await ensureAnalysisSession({ sessionKey, sampleName, source });
    const snapshot: RuntimeSnapshot = {
      sessionKey,
      sampleName,
      status: session?.status ?? "running",
      latestClassification: session?.latestClassification ?? "Benigno",
      latestConfidence: session?.latestConfidence ?? 0,
      logs: [],
      detections: [],
      alerts: [],
      functionTable: [],
      flowEdges: [],
      narrativeReport: session?.narrativeReport ?? null,
      updatedAt: new Date().toISOString(),
    };

    this.snapshots.set(sessionKey, snapshot);
    return snapshot;
  }

  private async persistAndSync(sessionKey: string) {
    const bundle = await getSessionBundle(sessionKey);
    if (!bundle) return this.snapshots.get(sessionKey) ?? null;

    const logs: RuntimeLog[] = bundle.events
      .slice()
      .reverse()
      .slice(-MAX_LOG_BUFFER)
      .map(event => ({
        TID: event.tid,
        StartTime: event.startTime,
        FunctionName: event.functionName,
        ModuleName: event.moduleName,
        DurationTicks: event.durationTicks,
        category: event.category ?? undefined,
        description: event.description ?? undefined,
        anomalyFlag: Boolean(event.anomalyFlag),
        anomalyReason: event.anomalyReason,
      }));

    const detections = bundle.detections
      .slice()
      .reverse()
      .map(item => ({
        classification: item.classification,
        confidence: item.confidence,
        rationale: item.rationale ?? undefined,
      }));

    const alertItems = bundle.alerts
      .slice()
      .reverse()
      .map(item => ({
        title: item.title,
        message: item.message,
        severity: item.severity,
        classification: item.classification,
      }));

    const snapshot: RuntimeSnapshot = {
      sessionKey,
      sampleName: bundle.session.sampleName,
      status: bundle.session.status,
      latestClassification: bundle.session.latestClassification,
      latestConfidence: bundle.session.latestConfidence,
      logs,
      detections,
      alerts: alertItems,
      functionTable: buildFunctionTable(logs),
      flowEdges: buildFlowEdges(logs),
      narrativeReport: bundle.report?.narrative ?? bundle.session.narrativeReport ?? null,
      updatedAt: new Date().toISOString(),
    };

    this.snapshots.set(sessionKey, snapshot);
    return snapshot;
  }

  async ingest(payload: RuntimeIngestPayload) {
    const snapshot = await this.ensureSnapshot(payload.sessionKey, payload.sampleName, payload.source);
    const session = await ensureAnalysisSession({
      sessionKey: payload.sessionKey,
      sampleName: payload.sampleName,
      source: payload.source,
    });

    if (!session) {
      return snapshot;
    }

    if (payload.log) {
      const normalizedLog: RuntimeLog = {
        ...payload.log,
        category: normalizeCategory(payload.log),
        description: normalizeDescription(payload.log),
      };

      await addFunctionEvent({
        sessionId: session.id,
        tid: normalizedLog.TID,
        startTime: normalizedLog.StartTime,
        functionName: normalizedLog.FunctionName,
        moduleName: normalizedLog.ModuleName,
        durationTicks: normalizedLog.DurationTicks,
        category: normalizedLog.category,
        description: normalizedLog.description,
        anomalyFlag: normalizedLog.anomalyFlag ? 1 : 0,
        anomalyReason: normalizedLog.anomalyReason ?? null,
      });
    }

    if (payload.detection) {
      await addDetection({
        sessionId: session.id,
        classification: payload.detection.classification,
        confidence: Math.max(0, Math.min(100, Math.round(payload.detection.confidence))),
        rationale: payload.detection.rationale ?? null,
      });

      if (HIGH_SEVERITY_CLASSES.has(payload.detection.classification)) {
        const alert: RuntimeAlert = payload.alert ?? {
          title: `Detecção de alta severidade: ${payload.detection.classification}`,
          message: `A sessão ${payload.sessionKey} apresentou a técnica ${payload.detection.classification} com confiança ${Math.round(payload.detection.confidence)}%.`,
          severity: "critical",
          classification: payload.detection.classification,
        };

        const persistedAlert = await addAlert({
          sessionId: session.id,
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
          classification: alert.classification,
          notifiedOwner: 0,
        });

        const notified = await notifyOwner({
          title: alert.title,
          content: `${alert.message}\n\nSessão: ${payload.sessionKey}`,
        });

        if (persistedAlert && notified) {
          await addAlert({
            sessionId: session.id,
            title: `${alert.title} (registrado)`,
            message: "A notificação ao analista foi enviada automaticamente pela plataforma.",
            severity: "info",
            classification: alert.classification,
            notifiedOwner: 1,
          });
        }
      }
    }

    if (payload.narrativeReport) {
      const exportBundle = await buildSessionExport(payload.sessionKey);
      await saveSessionReport({
        sessionId: session.id,
        reportJson: JSON.stringify(exportBundle ?? {}, null, 2),
        narrative: payload.narrativeReport,
      });
    }

    if (payload.status) {
      await updateAnalysisSessionStatus({
        sessionKey: payload.sessionKey,
        status: payload.status,
        latestClassification: payload.detection?.classification,
        latestConfidence: payload.detection?.confidence,
        endedAt: payload.status === "completed" || payload.status === "failed" ? new Date() : undefined,
      });
    }

    const synced = await this.persistAndSync(payload.sessionKey);
    this.emit("snapshot", synced);
    return synced;
  }

  async generateNarrative(sessionKey: string) {
    const exportBundle = await buildSessionExport(sessionKey);
    const session = await getSessionBundle(sessionKey);

    if (!exportBundle || !session) {
      throw new Error("Sessão não encontrada para geração de relatório narrativo.");
    }

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "Você é um analista sênior de malware. Gere um relatório narrativo conciso, técnico e interpretável, explicando técnicas evasivas, comportamento observado e recomendações de mitigação.",
        },
        {
          role: "user",
          content: `Gere um relatório em português com base neste resumo JSON da sessão:\n${JSON.stringify(exportBundle).slice(0, 12000)}`,
        },
      ],
      response_format: { type: "text" },
    });

    const narrative = typeof response.choices[0]?.message.content === "string"
      ? response.choices[0]?.message.content
      : JSON.stringify(response.choices[0]?.message.content);

    await saveSessionReport({
      sessionId: session.session.id,
      reportJson: JSON.stringify(exportBundle, null, 2),
      narrative,
    });

    const synced = await this.persistAndSync(sessionKey);
    this.emit("snapshot", synced);
    return synced;
  }

  async loadPersistedSessions() {
    const sessions = await listAnalysisSessions();
    for (const session of sessions.slice(0, 10)) {
      await this.persistAndSync(session.sessionKey);
    }
    return this.getSnapshots();
  }

  async seedDemoSession() {
    if (this.snapshots.size > 0) return this.getSnapshots();

    await this.ingest({
      sessionKey: "demo-session",
      sampleName: "full-execution-sample.exe",
      status: "running",
      log: {
        TID: "1184",
        StartTime: "1293849201",
        FunctionName: "IsDebuggerPresent",
        ModuleName: "kernel32.dll",
        DurationTicks: "91",
      },
      detection: {
        classification: "Anti-Debugging",
        confidence: 82,
        rationale: "Chamada inicial para verificar presença de depurador antes da continuação do fluxo.",
      },
    });

    await this.ingest({
      sessionKey: "demo-session",
      sampleName: "full-execution-sample.exe",
      status: "running",
      log: {
        TID: "1184",
        StartTime: "1293849312",
        FunctionName: "GetTickCount",
        ModuleName: "kernel32.dll",
        DurationTicks: "14",
        anomalyFlag: true,
        anomalyReason: "Loop de timing detectado em sequência curta.",
      },
    });

    await this.ingest({
      sessionKey: "demo-session",
      sampleName: "full-execution-sample.exe",
      status: "running",
      log: {
        TID: "1184",
        StartTime: "1293849440",
        FunctionName: "VirtualProtect",
        ModuleName: "kernel32.dll",
        DurationTicks: "227",
      },
      detection: {
        classification: "Injeção de Código",
        confidence: 93,
        rationale: "Mudança de permissão de memória em região suspeita após sondagens temporais.",
      },
    });

    await this.generateNarrative("demo-session");
    return this.getSnapshots();
  }
}

export const runtimeService = new RuntimeService();
