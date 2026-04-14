import { useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  BrainCircuit,
  Clock3,
  Download,
  Radar,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  type RuntimeAlert,
  type RuntimeDetection,
  type RuntimeFlowEdge,
  type RuntimeLog,
  useRuntimeMonitor,
} from "@/hooks/useRuntimeMonitor";
import { toast } from "sonner";

const TIMING_FUNCTIONS = [
  "GetTickCount",
  "QueryPerformanceCounter",
  "GetSystemTimeAsFileTime",
] as const;

const CLASS_STYLES: Record<string, string> = {
  Benigno: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/20",
  "Anti-Debugging": "bg-amber-500/15 text-amber-200 ring-amber-400/20",
  "Anti-VM": "bg-fuchsia-500/15 text-fuchsia-200 ring-fuchsia-400/20",
  "Injeção de Código": "bg-rose-500/15 text-rose-200 ring-rose-400/20",
  Ofuscação: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/20",
};

const ALERT_STYLES: Record<string, string> = {
  info: "border-sky-400/30 bg-sky-500/10 text-sky-100",
  medium: "border-amber-400/30 bg-amber-500/10 text-amber-50",
  high: "border-orange-400/30 bg-orange-500/10 text-orange-50",
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-50",
};

function shellClass() {
  return "rounded-[28px] border border-white/10 bg-white/5 shadow-[0_24px_120px_rgba(2,6,23,0.45)] backdrop-blur-xl";
}

function MetricCard({ title, value, hint, icon: Icon }: { title: string; value: string | number; hint: string; icon: typeof Activity }) {
  return (
    <div className={`${shellClass()} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{hint}</p>
        </div>
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ClassificationPill({ label }: { label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${CLASS_STYLES[label] ?? "bg-white/10 text-white ring-white/10"}`}>
      {label}
    </span>
  );
}

function formatChartData(detections: RuntimeDetection[]) {
  return detections.map((item, index) => ({
    name: `${item.classification.split(" ")[0]} ${index + 1}`,
    confidence: item.confidence,
  }));
}

function formatTimingData(logs: RuntimeLog[]) {
  return logs.slice(-12).map(log => ({
    name: log.FunctionName,
    ticks: Number(log.DurationTicks) || 0,
  }));
}

function FlowMap({ edges }: { edges: RuntimeFlowEdge[] }) {
  const visible = edges.slice(0, 8);

  return (
    <div className="space-y-3">
      {visible.length === 0 ? (
        <p className="text-sm text-slate-400">O grafo será exibido assim que a sessão acumular chamadas suficientes.</p>
      ) : (
        visible.map(edge => (
          <button
            key={`${edge.from}-${edge.to}`}
            type="button"
            className="group flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-left transition hover:border-cyan-400/30 hover:bg-white/8"
          >
            <div className="min-w-0 flex-1 rounded-2xl border border-white/8 bg-slate-950/60 px-3 py-2">
              <p className="truncate text-sm font-medium text-white">{edge.from}</p>
              <p className="mt-1 text-xs text-slate-400">Origem</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-cyan-300 transition group-hover:translate-x-1" />
            <div className="min-w-0 flex-1 rounded-2xl border border-white/8 bg-slate-950/60 px-3 py-2">
              <p className="truncate text-sm font-medium text-white">{edge.to}</p>
              <p className="mt-1 text-xs text-slate-400">{edge.category} · {edge.count} ocorrência(s)</p>
            </div>
          </button>
        ))
      )}
    </div>
  );
}

function LogsTable({ logs }: { logs: RuntimeLog[] }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/8 bg-slate-950/50">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              {[
                "TID",
                "StartTime",
                "FunctionName",
                "ModuleName",
                "DurationTicks",
              ].map(header => (
                <th key={header} className="px-4 py-3 font-medium">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-slate-400" colSpan={5}>
                  Nenhum evento recebido ainda para esta sessão.
                </td>
              </tr>
            ) : (
              logs.map((log, index) => (
                <tr key={`${log.TID}-${log.StartTime}-${index}`} className="border-t border-white/6 text-slate-200">
                  <td className="px-4 py-3">{log.TID}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{log.StartTime}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{log.FunctionName}</span>
                      {log.anomalyFlag ? <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] text-rose-200">Timing alert</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{log.ModuleName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-cyan-200">{log.DurationTicks}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TimingAlerts({ logs }: { logs: RuntimeLog[] }) {
  const timingLogs = logs.filter(log => TIMING_FUNCTIONS.includes(log.FunctionName as (typeof TIMING_FUNCTIONS)[number]));

  return (
    <div className="space-y-3">
      {timingLogs.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma das APIs de timing monitoradas foi observada nesta sessão.</p>
      ) : (
        timingLogs.map((log, index) => (
          <div key={`${log.FunctionName}-${log.StartTime}-${index}`} className={`rounded-2xl border px-4 py-3 ${log.anomalyFlag ? "border-rose-400/30 bg-rose-500/10" : "border-white/8 bg-white/5"}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">{log.FunctionName}</p>
                <p className="mt-1 text-xs text-slate-400">StartTime {log.StartTime} · DurationTicks {log.DurationTicks}</p>
              </div>
              {log.anomalyFlag ? (
                <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs text-rose-100">Anomalia detectada</span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-100">Sem anomalia</span>
              )}
            </div>
            {log.anomalyReason ? <p className="mt-3 text-sm text-slate-300">{log.anomalyReason}</p> : null}
          </div>
        ))
      )}
    </div>
  );
}

function AlertsPanel({ alerts }: { alerts: RuntimeAlert[] }) {
  return (
    <div className="space-y-3">
      {alerts.length === 0 ? (
        <p className="text-sm text-slate-400">Os alertas automáticos aparecerão aqui quando a IA detectar eventos relevantes.</p>
      ) : (
        alerts.map((alert, index) => (
          <div key={`${alert.title}-${index}`} className={`rounded-2xl border px-4 py-3 ${ALERT_STYLES[alert.severity] ?? ALERT_STYLES.info}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{alert.title}</p>
              <ClassificationPill label={alert.classification} />
            </div>
            <p className="mt-2 text-sm text-current/90">{alert.message}</p>
          </div>
        ))
      )}
    </div>
  );
}

function MalwareDashboard() {
  const { sessions, overview, isLoading, refetch, generateNarrative, seedDemo } = useRuntimeMonitor();
  const utils = trpc.useUtils();
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSessionKey && sessions[0]) {
      setSelectedSessionKey(sessions[0].sessionKey);
    }
  }, [sessions, selectedSessionKey]);

  const selectedSession = useMemo(
    () => sessions.find(session => session.sessionKey === selectedSessionKey) ?? sessions[0] ?? null,
    [sessions, selectedSessionKey]
  );

  const detectionChartData = useMemo(
    () => formatChartData(selectedSession?.detections ?? []),
    [selectedSession]
  );
  const timingChartData = useMemo(
    () => formatTimingData(selectedSession?.logs.filter(log => TIMING_FUNCTIONS.includes(log.FunctionName as (typeof TIMING_FUNCTIONS)[number])) ?? []),
    [selectedSession]
  );

  async function handleExport() {
    if (!selectedSession) return;
    const payload = await utils.runtime.exportJson.fetch({ sessionKey: selectedSession.sessionKey });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedSession.sessionKey}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleNarrative() {
    if (!selectedSession) return;
    await generateNarrative.mutateAsync({ sessionKey: selectedSession.sessionKey });
    toast.success("Relatório narrativo atualizado.");
    await refetch();
  }

  async function handleSeedDemo() {
    await seedDemo.mutateAsync();
    toast.success("Sessão de demonstração carregada.");
    await refetch();
  }

  return (
    <div className="space-y-6">
      <section className={`${shellClass()} overflow-hidden p-6 lg:p-8`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.14),_transparent_32%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              Threat Intelligence Command Center
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white lg:text-5xl">
              Plataforma de análise de malware em tempo real com IA interpretável, fluxo executivo e resposta imediata.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 lg:text-base">
              Monitore chamadas de função em tempo real, acompanhe anomalias de timing, classifique técnicas evasivas e gere relatórios narrativos técnicos a partir dos sinais coletados pelo AIAnalyzer.py.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={() => void handleNarrative()} className="rounded-2xl bg-cyan-400 px-5 text-slate-950 hover:bg-cyan-300">
                <Bot className="mr-2 h-4 w-4" />
                Gerar relatório narrativo
              </Button>
              <Button variant="outline" onClick={() => void handleExport()} className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10">
                <Download className="mr-2 h-4 w-4" />
                Exportar JSON
              </Button>
              <Button variant="outline" onClick={() => void handleSeedDemo()} className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10">
                <Radar className="mr-2 h-4 w-4" />
                Carregar demonstração
              </Button>
            </div>
          </div>
          <div className="grid gap-4 rounded-[24px] border border-white/10 bg-slate-950/40 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sessão em foco</p>
              <p className="mt-3 text-xl font-semibold text-white">{selectedSession?.sampleName ?? "Aguardando ingestão"}</p>
              <p className="mt-2 text-sm text-slate-400">{selectedSession?.sessionKey ?? "Nenhuma sessão selecionada"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ClassificationPill label={selectedSession?.latestClassification ?? "Benigno"} />
              <span className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs text-slate-200 ring-1 ring-white/10">
                Confiança {selectedSession?.latestConfidence ?? 0}%
              </span>
              <span className="inline-flex items-center rounded-full bg-white/5 px-3 py-1 text-xs text-slate-200 ring-1 ring-white/10">
                Status {selectedSession?.status ?? "idle"}
              </span>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Notificações críticas</p>
              <p className="mt-2 text-2xl font-semibold text-white">{selectedSession?.alerts.filter(alert => alert.severity === "critical").length ?? 0}</p>
              <p className="mt-2 text-sm text-slate-400">Anti-VM e Injeção de Código geram alertas automáticos ao analista.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Sessões" value={overview.totalSessions} hint="Histórico disponível para revisão e exportação." icon={Radar} />
        <MetricCard title="Execuções ativas" value={overview.activeSessions} hint="Monitoramento vivo alimentado por SSE." icon={Activity} />
        <MetricCard title="Detecções" value={overview.totalDetections} hint="Classificações geradas pela camada analítica." icon={BrainCircuit} />
        <MetricCard title="Alertas" value={overview.totalAlerts} hint="Eventos críticos sinalizados automaticamente." icon={ShieldAlert} />
        <MetricCard title="Anomalias" value={overview.totalAnomalies} hint="Indicadores de timing nas APIs monitoradas." icon={Clock3} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          <div className={`${shellClass()} p-6`}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Fluxo de execução</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Caminho percorrido pelo malware</h2>
              </div>
              <Button variant="outline" onClick={() => void refetch()} className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10">
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </div>
            <FlowMap edges={selectedSession?.flowEdges ?? []} />
          </div>

          <div className={`${shellClass()} p-6`}>
            <div className="mb-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Logs em tempo real</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Chamadas observadas</h2>
            </div>
            <LogsTable logs={selectedSession?.logs ?? []} />
          </div>

          <div className={`${shellClass()} p-6`}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tabela quantitativa</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Funções e contexto operacional</h2>
              </div>
              <div className="text-sm text-slate-400">Contagem, categoria e descrição por API</div>
            </div>
            <div className="overflow-hidden rounded-[24px] border border-white/8 bg-slate-950/50">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/5 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">FunctionName</th>
                      <th className="px-4 py-3 font-medium">Count</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedSession?.functionTable ?? []).map(row => (
                      <tr key={row.FunctionName} className="border-t border-white/6 text-slate-200">
                        <td className="px-4 py-3 font-medium text-white">{row.FunctionName}</td>
                        <td className="px-4 py-3 text-cyan-200">{row.Count}</td>
                        <td className="px-4 py-3 text-slate-300">{row.Category}</td>
                        <td className="px-4 py-3 text-slate-400">{row.Description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`${shellClass()} p-6`}>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Sessões</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Histórico operacional</h2>
            <div className="mt-5 space-y-3">
              {sessions.map(session => (
                <button
                  key={session.sessionKey}
                  type="button"
                  onClick={() => setSelectedSessionKey(session.sessionKey)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedSession?.sessionKey === session.sessionKey ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/8 bg-white/5 hover:bg-white/8"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{session.sampleName}</p>
                      <p className="mt-1 text-xs text-slate-400">{session.sessionKey}</p>
                    </div>
                    <ClassificationPill label={session.latestClassification} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>Status {session.status}</span>
                    <span>•</span>
                    <span>Confiança {session.latestConfidence}%</span>
                    <span>•</span>
                    <span>{new Date(session.updatedAt).toLocaleString()}</span>
                  </div>
                </button>
              ))}
              {!isLoading && sessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/12 bg-white/3 px-4 py-8 text-sm text-slate-400">
                  Nenhuma sessão disponível. Use o botão de demonstração para popular o ambiente ou envie eventos do AIAnalyzer.py.
                </div>
              ) : null}
            </div>
          </div>

          <div className={`${shellClass()} p-6`}>
            <div className="mb-5 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-200" />
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Timing monitor</p>
                <h2 className="mt-1 text-xl font-semibold text-white">GetTickCount, QueryPerformanceCounter e GetSystemTimeAsFileTime</h2>
              </div>
            </div>
            <TimingAlerts logs={selectedSession?.logs ?? []} />
            <div className="mt-5 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timingChartData}>
                  <defs>
                    <linearGradient id="timingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
                  <Area type="monotone" dataKey="ticks" stroke="#22d3ee" fill="url(#timingGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${shellClass()} p-6`}>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Detecção da IA</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Classes e confiança</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {(selectedSession?.detections ?? []).map((item, index) => (
                <ClassificationPill key={`${item.classification}-${index}`} label={item.classification} />
              ))}
            </div>
            <div className="mt-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={detectionChartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
                  <Bar dataKey="confidence" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-3">
              {(selectedSession?.detections ?? []).map((item, index) => (
                <div key={`${item.classification}-${index}-detail`} className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <ClassificationPill label={item.classification} />
                    <span className="text-sm text-white">{item.confidence}%</span>
                  </div>
                  {item.rationale ? <p className="mt-3 text-sm text-slate-300">{item.rationale}</p> : null}
                </div>
              ))}
            </div>
          </div>

          <div className={`${shellClass()} p-6`}>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Alertas automáticos</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Severidade operacional</h2>
            <div className="mt-5">
              <AlertsPanel alerts={selectedSession?.alerts ?? []} />
            </div>
          </div>

          <div className={`${shellClass()} p-6`}>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Relatório narrativo</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Interpretação em linguagem natural</h2>
            <div className="mt-5 rounded-[24px] border border-white/8 bg-slate-950/55 p-4 text-sm leading-7 text-slate-200">
              {selectedSession?.narrativeReport ? (
                <Streamdown>{selectedSession.narrativeReport}</Streamdown>
              ) : (
                <p className="text-slate-400">
                  Gere um relatório para consolidar as técnicas evasivas detectadas, o comportamento observado e as recomendações de mitigação.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  return (
    <DashboardLayout>
      <MalwareDashboard />
    </DashboardLayout>
  );
}
