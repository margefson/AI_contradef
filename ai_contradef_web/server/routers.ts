import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { buildSessionExport } from "./db";
import { runtimeService } from "./runtimeService";

const detectionClassEnum = z.enum([
  "Benigno",
  "Anti-Debugging",
  "Anti-VM",
  "Injeção de Código",
  "Ofuscação",
]);

const severityEnum = z.enum(["info", "medium", "high", "critical"]);
const statusEnum = z.enum(["idle", "running", "completed", "failed"]);

const runtimeLogSchema = z.object({
  TID: z.string(),
  StartTime: z.string(),
  FunctionName: z.string(),
  ModuleName: z.string(),
  DurationTicks: z.string(),
  category: z.string().optional(),
  description: z.string().optional(),
  anomalyFlag: z.boolean().optional(),
  anomalyReason: z.string().nullable().optional(),
});

const runtimeDetectionSchema = z.object({
  classification: detectionClassEnum,
  confidence: z.number().min(0).max(100),
  rationale: z.string().optional(),
});

const runtimeAlertSchema = z.object({
  title: z.string(),
  message: z.string(),
  severity: severityEnum,
  classification: detectionClassEnum,
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  runtime: router({
    sessions: protectedProcedure.query(async () => {
      const loaded = await runtimeService.loadPersistedSessions();
      if (loaded.length > 0) return loaded;
      return runtimeService.seedDemoSession();
    }),
    overview: protectedProcedure.query(async () => {
      const snapshots = await runtimeService.loadPersistedSessions();
      const active = snapshots.filter(item => item.status === "running");
      const anomalies = snapshots.reduce(
        (count, snapshot) =>
          count + snapshot.logs.filter(log => log.anomalyFlag).length,
        0
      );

      return {
        totalSessions: snapshots.length,
        activeSessions: active.length,
        totalDetections: snapshots.reduce((sum, item) => sum + item.detections.length, 0),
        totalAlerts: snapshots.reduce((sum, item) => sum + item.alerts.length, 0),
        totalAnomalies: anomalies,
      };
    }),
    session: protectedProcedure
      .input(z.object({ sessionKey: z.string() }))
      .query(async ({ input }) => {
        const loaded = await runtimeService.loadPersistedSessions();
        const direct = runtimeService.getSnapshot(input.sessionKey);
        if (direct) return direct;
        if (loaded.length === 0) {
          await runtimeService.seedDemoSession();
          return runtimeService.getSnapshot(input.sessionKey);
        }
        return null;
      }),
    exportJson: protectedProcedure
      .input(z.object({ sessionKey: z.string() }))
      .query(async ({ input }) => buildSessionExport(input.sessionKey)),
    ingest: publicProcedure
      .input(
        z.object({
          sessionKey: z.string(),
          sampleName: z.string(),
          source: z.string().optional(),
          status: statusEnum.optional(),
          log: runtimeLogSchema.optional(),
          detection: runtimeDetectionSchema.optional(),
          alert: runtimeAlertSchema.optional(),
          narrativeReport: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => runtimeService.ingest(input)),
    generateNarrative: protectedProcedure
      .input(z.object({ sessionKey: z.string() }))
      .mutation(async ({ input }) => runtimeService.generateNarrative(input.sessionKey)),
    seedDemo: protectedProcedure.mutation(async () => runtimeService.seedDemoSession()),
  }),
});

export type AppRouter = typeof appRouter;
