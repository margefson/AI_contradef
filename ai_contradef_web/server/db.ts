import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  alerts,
  analysisSessions,
  detections,
  functionEvents,
  InsertAlert,
  InsertAnalysisSession,
  InsertDetection,
  InsertFunctionEvent,
  InsertSessionReport,
  InsertUser,
  sessionReports,
  users,
  type AnalysisStatus,
  type DetectionClass,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = {
    openId: user.openId,
  };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };

  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) {
    values.lastSignedIn = new Date();
  }

  if (Object.keys(updateSet).length === 0) {
    updateSet.lastSignedIn = new Date();
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({
    set: updateSet,
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createAnalysisSession(input: {
  sessionKey: string;
  sampleName: string;
  source?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const payload: InsertAnalysisSession = {
    sessionKey: input.sessionKey,
    sampleName: input.sampleName,
    source: input.source ?? "AIAnalyzer.py",
    status: "running",
    latestClassification: "Benigno",
    latestConfidence: 0,
    startedAt: new Date(),
  };

  await db.insert(analysisSessions).values(payload);
  return getAnalysisSessionByKey(input.sessionKey);
}

export async function getAnalysisSessionByKey(sessionKey: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(analysisSessions)
    .where(eq(analysisSessions.sessionKey, sessionKey))
    .limit(1);

  return result[0] ?? null;
}

export async function ensureAnalysisSession(input: {
  sessionKey: string;
  sampleName: string;
  source?: string;
}) {
  const existing = await getAnalysisSessionByKey(input.sessionKey);
  if (existing) return existing;
  return createAnalysisSession(input);
}

export async function updateAnalysisSessionStatus(input: {
  sessionKey: string;
  status: AnalysisStatus;
  latestClassification?: DetectionClass;
  latestConfidence?: number;
  endedAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) return null;

  await db
    .update(analysisSessions)
    .set({
      status: input.status,
      ...(input.latestClassification
        ? { latestClassification: input.latestClassification }
        : {}),
      ...(typeof input.latestConfidence === "number"
        ? { latestConfidence: input.latestConfidence }
        : {}),
      ...(input.endedAt !== undefined ? { endedAt: input.endedAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(analysisSessions.sessionKey, input.sessionKey));

  return getAnalysisSessionByKey(input.sessionKey);
}

export async function addFunctionEvent(input: InsertFunctionEvent) {
  const db = await getDb();
  if (!db) return null;

  await db.insert(functionEvents).values(input);

  const result = await db
    .select()
    .from(functionEvents)
    .where(eq(functionEvents.sessionId, input.sessionId))
    .orderBy(desc(functionEvents.id))
    .limit(1);

  return result[0] ?? null;
}

export async function addDetection(input: InsertDetection) {
  const db = await getDb();
  if (!db) return null;

  await db.insert(detections).values(input);
  await db
    .update(analysisSessions)
    .set({
      latestClassification: input.classification,
      latestConfidence: input.confidence,
      updatedAt: new Date(),
    })
    .where(eq(analysisSessions.id, input.sessionId));

  const result = await db
    .select()
    .from(detections)
    .where(eq(detections.sessionId, input.sessionId))
    .orderBy(desc(detections.id))
    .limit(1);

  return result[0] ?? null;
}

export async function addAlert(input: InsertAlert) {
  const db = await getDb();
  if (!db) return null;

  await db.insert(alerts).values(input);
  const result = await db
    .select()
    .from(alerts)
    .where(eq(alerts.sessionId, input.sessionId))
    .orderBy(desc(alerts.id))
    .limit(1);

  return result[0] ?? null;
}

export async function saveSessionReport(input: InsertSessionReport) {
  const db = await getDb();
  if (!db) return null;

  await db.insert(sessionReports).values(input).onDuplicateKeyUpdate({
    set: {
      reportJson: input.reportJson,
      narrative: input.narrative ?? null,
      updatedAt: new Date(),
    },
  });

  const result = await db
    .select()
    .from(sessionReports)
    .where(eq(sessionReports.sessionId, input.sessionId))
    .limit(1);

  return result[0] ?? null;
}

export async function listAnalysisSessions() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(analysisSessions).orderBy(desc(analysisSessions.updatedAt));
}

export async function getFunctionEventsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(functionEvents)
    .where(eq(functionEvents.sessionId, sessionId))
    .orderBy(desc(functionEvents.id));
}

export async function getDetectionsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(detections)
    .where(eq(detections.sessionId, sessionId))
    .orderBy(desc(detections.id));
}

export async function getAlertsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(alerts)
    .where(eq(alerts.sessionId, sessionId))
    .orderBy(desc(alerts.id));
}

export async function getSessionReportBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(sessionReports)
    .where(eq(sessionReports.sessionId, sessionId))
    .limit(1);

  return result[0] ?? null;
}

export async function getSessionBundle(sessionKey: string) {
  const session = await getAnalysisSessionByKey(sessionKey);
  if (!session) return null;

  const [events, detectionRows, alertRows, report] = await Promise.all([
    getFunctionEventsBySession(session.id),
    getDetectionsBySession(session.id),
    getAlertsBySession(session.id),
    getSessionReportBySession(session.id),
  ]);

  return {
    session,
    events,
    detections: detectionRows,
    alerts: alertRows,
    report,
  };
}

export async function buildSessionExport(sessionKey: string) {
  const bundle = await getSessionBundle(sessionKey);
  if (!bundle) return null;

  const tableMap = new Map<
    string,
    {
      FunctionName: string;
      Count: number;
      Category: string;
      Description: string;
    }
  >();

  for (const event of bundle.events) {
    const current = tableMap.get(event.functionName);
    if (current) {
      current.Count += 1;
      if (!current.Category && event.category) current.Category = event.category;
      if (!current.Description && event.description) current.Description = event.description;
      continue;
    }

    tableMap.set(event.functionName, {
      FunctionName: event.functionName,
      Count: 1,
      Category: event.category ?? "Uncategorized",
      Description: event.description ?? "Sem descrição disponível.",
    });
  }

  return {
    session: bundle.session,
    functionLogs: bundle.events.map(event => ({
      TID: event.tid,
      StartTime: event.startTime,
      FunctionName: event.functionName,
      ModuleName: event.moduleName,
      DurationTicks: event.durationTicks,
      category: event.category,
      description: event.description,
      anomalyFlag: Boolean(event.anomalyFlag),
      anomalyReason: event.anomalyReason,
    })),
    detections: bundle.detections,
    alerts: bundle.alerts,
    quantitativeFunctions: Array.from(tableMap.values()).sort((a, b) => b.Count - a.Count),
    narrativeReport: bundle.report?.narrative ?? bundle.session.narrativeReport ?? null,
    exportedAt: new Date().toISOString(),
  };
}
