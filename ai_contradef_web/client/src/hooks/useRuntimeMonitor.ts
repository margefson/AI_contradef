import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export type DetectionClass =
  | "Benigno"
  | "Anti-Debugging"
  | "Anti-VM"
  | "Injeção de Código"
  | "Ofuscação";

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

type RuntimeOverview = {
  totalSessions: number;
  activeSessions: number;
  totalDetections: number;
  totalAlerts: number;
  totalAnomalies: number;
};

function upsertSnapshot(collection: RuntimeSnapshot[], incoming: RuntimeSnapshot) {
  const next = collection.filter(item => item.sessionKey !== incoming.sessionKey);
  next.unshift(incoming);
  return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function useRuntimeMonitor() {
  const [liveSessions, setLiveSessions] = useState<RuntimeSnapshot[]>([]);
  const sessionsQuery = trpc.runtime.sessions.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const overviewQuery = trpc.runtime.overview.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const generateNarrative = trpc.runtime.generateNarrative.useMutation();
  const seedDemo = trpc.runtime.seedDemo.useMutation();

  useEffect(() => {
    if (sessionsQuery.data) {
      setLiveSessions(sessionsQuery.data as RuntimeSnapshot[]);
    }
  }, [sessionsQuery.data]);

  useEffect(() => {
    const source = new EventSource("/api/runtime/stream");

    source.addEventListener("bootstrap", event => {
      const data = JSON.parse((event as MessageEvent).data) as RuntimeSnapshot[];
      setLiveSessions(data);
    });

    source.addEventListener("snapshot", event => {
      const snapshot = JSON.parse((event as MessageEvent).data) as RuntimeSnapshot;
      setLiveSessions(current => upsertSnapshot(current, snapshot));

      const hasCriticalAlert = snapshot.alerts.some(alert => alert.severity === "critical");
      if (hasCriticalAlert) {
        const alert = snapshot.alerts[snapshot.alerts.length - 1];
        if (alert) {
          toast.error(alert.title, { description: alert.message });
        }
      }
    });

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, []);

  const selectedSession = liveSessions[0] ?? null;

  const overview = useMemo<RuntimeOverview>(() => {
    if (overviewQuery.data) {
      return overviewQuery.data as RuntimeOverview;
    }

    return {
      totalSessions: liveSessions.length,
      activeSessions: liveSessions.filter(item => item.status === "running").length,
      totalDetections: liveSessions.reduce((sum, item) => sum + item.detections.length, 0),
      totalAlerts: liveSessions.reduce((sum, item) => sum + item.alerts.length, 0),
      totalAnomalies: liveSessions.reduce(
        (sum, item) => sum + item.logs.filter(log => log.anomalyFlag).length,
        0
      ),
    };
  }, [liveSessions, overviewQuery.data]);

  return {
    sessions: liveSessions,
    selectedSession,
    overview,
    isLoading: sessionsQuery.isLoading,
    refetch: sessionsQuery.refetch,
    generateNarrative,
    seedDemo,
  };
}
