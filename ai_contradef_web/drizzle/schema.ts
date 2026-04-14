import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const analysisStatus = ["idle", "running", "completed", "failed"] as const;
export const detectionClasses = [
  "Benigno",
  "Anti-Debugging",
  "Anti-VM",
  "Injeção de Código",
  "Ofuscação",
] as const;
export const severityLevels = ["info", "medium", "high", "critical"] as const;

export const analysisSessions = mysqlTable(
  "analysisSessions",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionKey: varchar("sessionKey", { length: 64 }).notNull(),
    sampleName: varchar("sampleName", { length: 255 }).notNull(),
    source: varchar("source", { length: 255 }).default("AIAnalyzer.py").notNull(),
    status: mysqlEnum("status", analysisStatus).default("idle").notNull(),
    latestClassification: mysqlEnum("latestClassification", detectionClasses).default("Benigno").notNull(),
    latestConfidence: int("latestConfidence").default(0).notNull(),
    narrativeReport: text("narrativeReport"),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    endedAt: timestamp("endedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    sessionKeyIdx: uniqueIndex("analysisSessions_sessionKey_idx").on(table.sessionKey),
    statusIdx: index("analysisSessions_status_idx").on(table.status),
  })
);

export const functionEvents = mysqlTable(
  "functionEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId").notNull(),
    tid: varchar("tid", { length: 64 }).notNull(),
    startTime: varchar("startTime", { length: 64 }).notNull(),
    functionName: varchar("functionName", { length: 255 }).notNull(),
    moduleName: varchar("moduleName", { length: 255 }).notNull(),
    durationTicks: varchar("durationTicks", { length: 64 }).notNull(),
    category: varchar("category", { length: 128 }),
    description: text("description"),
    anomalyFlag: int("anomalyFlag").default(0).notNull(),
    anomalyReason: varchar("anomalyReason", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    sessionIdx: index("functionEvents_session_idx").on(table.sessionId),
    functionIdx: index("functionEvents_function_idx").on(table.functionName),
  })
);

export const detections = mysqlTable(
  "detections",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId").notNull(),
    classification: mysqlEnum("classification", detectionClasses).notNull(),
    confidence: int("confidence").notNull(),
    rationale: text("rationale"),
    source: varchar("source", { length: 128 }).default("AIAnalyzer.py").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    sessionIdx: index("detections_session_idx").on(table.sessionId),
    classIdx: index("detections_class_idx").on(table.classification),
  })
);

export const alerts = mysqlTable(
  "alerts",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    severity: mysqlEnum("severity", severityLevels).notNull(),
    classification: mysqlEnum("classification", detectionClasses).notNull(),
    notifiedOwner: int("notifiedOwner").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    sessionIdx: index("alerts_session_idx").on(table.sessionId),
    severityIdx: index("alerts_severity_idx").on(table.severity),
  })
);

export const sessionReports = mysqlTable(
  "sessionReports",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId").notNull(),
    reportJson: text("reportJson").notNull(),
    narrative: text("narrative"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    sessionIdx: uniqueIndex("sessionReports_session_idx").on(table.sessionId),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AnalysisSession = typeof analysisSessions.$inferSelect;
export type InsertAnalysisSession = typeof analysisSessions.$inferInsert;
export type FunctionEvent = typeof functionEvents.$inferSelect;
export type InsertFunctionEvent = typeof functionEvents.$inferInsert;
export type Detection = typeof detections.$inferSelect;
export type InsertDetection = typeof detections.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;
export type SessionReport = typeof sessionReports.$inferSelect;
export type InsertSessionReport = typeof sessionReports.$inferInsert;
export type DetectionClass = (typeof detectionClasses)[number];
export type AnalysisStatus = (typeof analysisStatus)[number];
export type SeverityLevel = (typeof severityLevels)[number];
