import { beforeEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { runtimeService } from "./runtimeService";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
    } as TrpcContext["res"],
  };
}

describe("runtime router", () => {
  beforeEach(async () => {
    await runtimeService.seedDemoSession();
  });

  it("retorna sessões monitoradas com os campos de log esperados", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const sessions = await caller.runtime.sessions();

    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]?.logs[0]).toMatchObject({
      TID: expect.any(String),
      StartTime: expect.any(String),
      FunctionName: expect.any(String),
      ModuleName: expect.any(String),
      DurationTicks: expect.any(String),
    });
  });

  it("ingere um evento com detecção crítica e consolida a exportação JSON", async () => {
    const caller = appRouter.createCaller(createAuthContext());

    await caller.runtime.ingest({
      sessionKey: "vitest-session",
      sampleName: "vitest.exe",
      status: "running",
      log: {
        TID: "4321",
        StartTime: "999001",
        FunctionName: "QueryPerformanceCounter",
        ModuleName: "kernel32.dll",
        DurationTicks: "17",
        anomalyFlag: true,
        anomalyReason: "Sequência temporal atípica durante execução de teste.",
      },
      detection: {
        classification: "Anti-VM",
        confidence: 97,
        rationale: "A sessão simulada apresentou traços consistentes com evasão de ambiente virtual.",
      },
    });

    const exported = await caller.runtime.exportJson({ sessionKey: "vitest-session" });

    expect(exported?.session.sessionKey).toBe("vitest-session");
    expect(exported?.functionLogs.some(log => log.FunctionName === "QueryPerformanceCounter")).toBe(true);
    expect(exported?.alerts.some(alert => alert.classification === "Anti-VM")).toBe(true);
    expect(exported?.quantitativeFunctions[0]).toMatchObject({
      FunctionName: expect.any(String),
      Count: expect.any(Number),
      Category: expect.any(String),
    });
  });
});
