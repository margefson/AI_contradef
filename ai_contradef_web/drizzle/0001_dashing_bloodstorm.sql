CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`severity` enum('info','medium','high','critical') NOT NULL,
	`classification` enum('Benigno','Anti-Debugging','Anti-VM','Injeção de Código','Ofuscação') NOT NULL,
	`notifiedOwner` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analysisSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionKey` varchar(64) NOT NULL,
	`sampleName` varchar(255) NOT NULL,
	`source` varchar(255) NOT NULL DEFAULT 'AIAnalyzer.py',
	`status` enum('idle','running','completed','failed') NOT NULL DEFAULT 'idle',
	`latestClassification` enum('Benigno','Anti-Debugging','Anti-VM','Injeção de Código','Ofuscação') NOT NULL DEFAULT 'Benigno',
	`latestConfidence` int NOT NULL DEFAULT 0,
	`narrativeReport` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `analysisSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `analysisSessions_sessionKey_idx` UNIQUE(`sessionKey`)
);
--> statement-breakpoint
CREATE TABLE `detections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`classification` enum('Benigno','Anti-Debugging','Anti-VM','Injeção de Código','Ofuscação') NOT NULL,
	`confidence` int NOT NULL,
	`rationale` text,
	`source` varchar(128) NOT NULL DEFAULT 'AIAnalyzer.py',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `detections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `functionEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`tid` varchar(64) NOT NULL,
	`startTime` varchar(64) NOT NULL,
	`functionName` varchar(255) NOT NULL,
	`moduleName` varchar(255) NOT NULL,
	`durationTicks` varchar(64) NOT NULL,
	`category` varchar(128),
	`description` text,
	`anomalyFlag` int NOT NULL DEFAULT 0,
	`anomalyReason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `functionEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessionReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`reportJson` text NOT NULL,
	`narrative` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sessionReports_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessionReports_session_idx` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE INDEX `alerts_session_idx` ON `alerts` (`sessionId`);--> statement-breakpoint
CREATE INDEX `alerts_severity_idx` ON `alerts` (`severity`);--> statement-breakpoint
CREATE INDEX `analysisSessions_status_idx` ON `analysisSessions` (`status`);--> statement-breakpoint
CREATE INDEX `detections_session_idx` ON `detections` (`sessionId`);--> statement-breakpoint
CREATE INDEX `detections_class_idx` ON `detections` (`classification`);--> statement-breakpoint
CREATE INDEX `functionEvents_session_idx` ON `functionEvents` (`sessionId`);--> statement-breakpoint
CREATE INDEX `functionEvents_function_idx` ON `functionEvents` (`functionName`);