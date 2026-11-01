import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";

let cachedConfig = null;
let loadedConfigPath = null;
let logFilePath = null;
let requestLogFilePath = null;
let queryLogFilePath = null;
let serverStartOn = null;
let db = null;
const pendingLogRows = [];
const pendingRequestLogRows = [];

const utilityFilePath = fileURLToPath(import.meta.url);
const utilityDir = path.dirname(utilityFilePath);
const projectRoot = path.resolve(utilityDir, "..");

// A missing logging key falls back to the DEFAULT here, never to "on" — the old
// `!== false` checks turned every absent key into a live sink (DB writes, console
// noise). Defaults: file only, plus message lines on the console.
function flag(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
}

function getLogOptions() {
    const config = loadConfig();
    const messageConfig = config?.logging?.message || {};

    return {
        logToFile: flag(messageConfig.log_to_file, true),
        logToConsole: flag(messageConfig.log_to_console, true),
        logToDatabase: flag(messageConfig.log_to_database, false),
        logDirectory: messageConfig.log_directory || "./logs",
        logFilePrefix: messageConfig.log_file_prefix || "message_",
        logFilePostfix: messageConfig.log_file_postfix || "",
    };
}

function getRequestLogOptions() {
    const config = loadConfig();
    const requestConfig = config?.logging?.request || {};

    return {
        logToFile: flag(requestConfig.log_to_file, true),
        logToConsole: flag(requestConfig.log_to_console, false),
        logToDatabase: flag(requestConfig.log_to_database, false),
        // What goes INTO a request log line. Off by default because headers,
        // query strings and bodies carry secrets (session cookies, API keys,
        // OAuth codes). Even when on, known-secret fields are redacted.
        logHeaders: flag(requestConfig.log_headers, false),
        logQuery: flag(requestConfig.log_query, false),
        logBody: flag(requestConfig.log_body, false),
        logDirectory: requestConfig.log_directory || "./logs",
        logFilePrefix: requestConfig.log_file_prefix || "requests_",
        logFilePostfix: requestConfig.log_file_postfix || "",
    };
}

export function getRequestLogContentOptions() {
    const { logHeaders, logQuery, logBody } = getRequestLogOptions();
    return { logHeaders, logQuery, logBody };
}

function getQueryLogOptions() {
    const config = loadConfig();
    const sequelizeConfig = config?.logging?.sequelize || {};

    return {
        logToFile: flag(sequelizeConfig.log_to_file, true),
        logToConsole: flag(sequelizeConfig.log_to_console, false),
        logDirectory: sequelizeConfig.log_directory || "./logs",
        logFilePrefix: sequelizeConfig.log_file_prefix || "queries_",
        logFilePostfix: sequelizeConfig.log_file_postfix || "",
    };
}

function resolveConfigPath() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // project root = one level up from lib/
    return path.resolve(__dirname, "../config.json");
}

// The FIRST call decides which file is the config for this process (server.js
// passes `--config <file>` here, e.g. for a test instance); every later call —
// from logging, the DB layer, plugins — gets that same cached object.
export function loadConfig(explicitPath) {
    if (cachedConfig) {
        return cachedConfig;
    }

    const configPath = explicitPath ? path.resolve(explicitPath) : resolveConfigPath();

    if (!fs.existsSync(configPath)) {
        throw new Error(
            explicitPath
                ? `Config file not found: ${configPath}`
                : "config.json not found. Copy config.example.json to config.json",
        );
    }

    // Strip a UTF-8 BOM: Windows editors (Notepad, some VS Code settings) save one,
    // and JSON.parse rejects it with a confusing "Unexpected token" error.
    const raw = fs.readFileSync(configPath, "utf-8").replace(/^﻿/, "");

    try {
        cachedConfig = JSON.parse(raw);
        loadedConfigPath = configPath;
    } catch (err) {
        throw new Error(`Invalid JSON format in ${path.basename(configPath)}: ${err.message}`);
    }

    return cachedConfig;
}

export function getConfigPath() {
    return loadedConfigPath;
}

// Logging functions
export function logInit() {
    const options = getLogOptions();

    const now = new Date();
    serverStartOn = now;

    if (!options.logToFile) {
        logFilePath = null;
        return null;
    }

    const logsDir = path.resolve(projectRoot, options.logDirectory);

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    logFilePath = path.resolve(
        logsDir,
        `${options.logFilePrefix}${timestamp}${options.logFilePostfix}.log`,
    );

    // Create empty log file
    fs.writeFileSync(logFilePath, "");

    return logFilePath;
}

export function requestLogInit() {
    const options = getRequestLogOptions();

    const now = new Date();

    if (!options.logToFile) {
        requestLogFilePath = null;
        return null;
    }

    const logsDir = path.resolve(projectRoot, options.logDirectory);

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    requestLogFilePath = path.resolve(
        logsDir,
        `${options.logFilePrefix}${timestamp}${options.logFilePostfix}.log`,
    );

    // Create empty log file
    fs.writeFileSync(requestLogFilePath, "");

    return requestLogFilePath;
}

export function queryLogInit() {
    const options = getQueryLogOptions();

    const now = new Date();

    if (!options.logToFile) {
        queryLogFilePath = null;
        return null;
    }

    const logsDir = path.resolve(projectRoot, options.logDirectory);

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    queryLogFilePath = path.resolve(
        logsDir,
        `${options.logFilePrefix}${timestamp}${options.logFilePostfix}.log`,
    );

    // Create empty log file
    fs.writeFileSync(queryLogFilePath, "");

    return queryLogFilePath;
}

function getRelativePath(importMetaUrl) {
    if (!importMetaUrl) {
        return "unknown";
    }

    const sourceFilePath = fileURLToPath(importMetaUrl);
    return path.relative(projectRoot, sourceFilePath).replace(/\\/g, "/");
}

function formatTimestamp() {
    return new Date().toISOString();
}

let log_levels = ["info", "warning", "error"];

export async function log(message, level = "info", importMetaUrl) {
    if (!serverStartOn) {
        serverStartOn = new Date();
    }

    const options = getLogOptions();

    let resolvedLevel = level;
    let resolvedImportMetaUrl = importMetaUrl;
    let levelNote = "";

    // Two call shapes are supported: log(msg, level, import.meta.url) and the
    // short log(msg, import.meta.url). The second argument is only treated as
    // the source URL when it IS a file URL — a typo'd level ("warnig") used to
    // be silently taken as a path and the line was logged as INFO from nowhere.
    if (
        resolvedImportMetaUrl === undefined &&
        typeof resolvedLevel === "string" &&
        resolvedLevel.startsWith("file:")
    ) {
        resolvedImportMetaUrl = resolvedLevel;
        resolvedLevel = "info";
    }

    resolvedLevel = typeof resolvedLevel === "string"
        ? resolvedLevel.toLowerCase()
        : "info";

    if (!log_levels.includes(resolvedLevel)) {
        levelNote = `[unknown level '${resolvedLevel}'] `;
        resolvedLevel = "info";
    }

    const relPath = getRelativePath(resolvedImportMetaUrl);
    const reportOn = new Date();
    const timestamp = formatTimestamp();
    const normalizedMessage = levelNote + String(message);
    const logMessage = `[${timestamp}] [${resolvedLevel.toUpperCase()}] [${relPath}]: ${normalizedMessage}\n`;

    if (options.logToConsole) {
        console.log(logMessage.trimEnd());
    }

    if (options.logToFile && logFilePath) {
        try {
            await fs.promises.appendFile(logFilePath, logMessage);
        } catch (err) {
            console.error("Error writing to log file:", err);
        }
    }

    if (options.logToDatabase) {
        if (db?.LogMessages) {
            try {
                await db.LogMessages.create({
                    server_start_on: serverStartOn,
                    report_by: relPath,
                    report_on: reportOn,
                    level: resolvedLevel,
                    messages: normalizedMessage,
                });
            } catch (err) {
                console.error("Error writing log to database:", err);
            }
        } else if (databaseWillExist()) {
            pendingLogRows.push({
                server_start_on: serverStartOn,
                report_by: relPath,
                report_on: reportOn,
                level: resolvedLevel,
                messages: normalizedMessage,
            });
        }
    }
}

log.info = async function info(message, importMetaUrl) {
    return log(message, "info", importMetaUrl);
};

log.warning = async function warning(message, importMetaUrl) {
    return log(message, "warning", importMetaUrl);
};

log.error = async function error(message, importMetaUrl) {
    return log(message, "error", importMetaUrl);
};

export function getLogPath() {
    return logFilePath;
}

export function setDB(db_from_plugin_init) {
    db = db_from_plugin_init;
    log_levels = db?.choices?.log_messages_level || log_levels;

    const messageOptions = getLogOptions();
    const requestOptions = getRequestLogOptions();

    // Flush pending message logs
    if (
        messageOptions.logToDatabase &&
        db?.LogMessages &&
        pendingLogRows.length > 0
    ) {
        const rowsToInsert = pendingLogRows.splice(0, pendingLogRows.length);
        Promise.all(
            rowsToInsert.map((row) => db.LogMessages.create(row)),
        ).catch((err) => {
            console.error(
                "Error flushing pending message logs to database:",
                err,
            );
        });
    } else if (!messageOptions.logToDatabase) {
        pendingLogRows.splice(0, pendingLogRows.length);
    }

    // Flush pending request logs
    if (
        requestOptions.logToDatabase &&
        db?.LogRequests &&
        pendingRequestLogRows.length > 0
    ) {
        const rowsToInsert = pendingRequestLogRows.splice(
            0,
            pendingRequestLogRows.length,
        );
        Promise.all(
            rowsToInsert.map((row) => db.LogRequests.create(row)),
        ).catch((err) => {
            console.error(
                "Error flushing pending request logs to database:",
                err,
            );
        });
    } else if (!requestOptions.logToDatabase) {
        pendingRequestLogRows.splice(0, pendingRequestLogRows.length);
    }
}

// ---- Redaction -----------------------------------------------------------------
// Request logs used to store every header and cookie verbatim, so live session
// cookies and API keys landed in logs/requests_*.log and log_requests (found in
// OLS, DCON, Portal, OSM, Otenization). These helpers are the single place that
// decides what is too sensitive to keep.
const SECRET_HEADER = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-.*-(key|token|secret))$/i;
const SECRET_FIELD = /(pass(word)?|secret|token|api[-_]?key|authorization|cookie|session|credential|otp|pin)/i;
const REDACTED = "[redacted]";

export function redactHeaders(headers = {}) {
    const out = {};
    for (const [name, value] of Object.entries(headers)) {
        out[name] = SECRET_HEADER.test(name) ? REDACTED : value;
    }
    return out;
}

export function redactBody(value, depth = 0) {
    if (value === null || typeof value !== "object") return value;
    if (depth > 6) return "[too deep]";
    if (Array.isArray(value)) return value.map((item) => redactBody(item, depth + 1));
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
        out[key] = SECRET_FIELD.test(key) ? REDACTED : redactBody(inner, depth + 1);
    }
    return out;
}

// Query strings carry one-time secrets (OAuth `code`, tickets) — values are
// dropped unless logging.request.log_query is on, and secret-named keys are
// redacted even then.
export function redactUrl(url, keepQuery) {
    const [pathname, query] = String(url).split("?", 2);
    if (!query) return pathname;
    if (!keepQuery) return `${pathname}?[query omitted]`;
    const params = new URLSearchParams(query);
    for (const key of [...params.keys()]) {
        if (SECRET_FIELD.test(key) || key === "code" || key === "state") params.set(key, REDACTED);
    }
    return `${pathname}?${params.toString()}`;
}

function databaseWillExist() {
    return loadConfig()?.database?.enabled !== false;
}

export async function logRequest(requestData) {
    const options = getRequestLogOptions();
    const timestamp = formatTimestamp();

    const logLine = `[${timestamp}] ${requestData.request_method} ${requestData.request_to} -> ${requestData.response_status} ${requestData.duration_ms}ms from ${requestData.request_ip}\n`;

    if (options.logToConsole) {
        console.log(logLine.trimEnd());
    }

    if (options.logToFile && requestLogFilePath) {
        try {
            await fs.promises.appendFile(requestLogFilePath, logLine);
        } catch (err) {
            console.error("Error writing request log to file:", err);
        }
    }

    if (options.logToDatabase) {
        if (db?.LogRequests) {
            try {
                await db.LogRequests.create(requestData);
            } catch (err) {
                console.error("Error writing request log to database:", err);
            }
        } else if (databaseWillExist()) {
            pendingRequestLogRows.push(requestData);
        }
    }
}

export function logQuery(query, duration_ms) {
    const options = getQueryLogOptions();
    const timestamp = formatTimestamp();

    const normalizedQuery =
        typeof query === "string" ? query : JSON.stringify(query);
    const hasDuration = Number.isFinite(duration_ms);
    const durationText = hasDuration ? ` (${duration_ms}ms)` : "";
    const logLine = `[${timestamp}] Query${durationText}: ${normalizedQuery}\n`;

    if (options.logToConsole) {
        console.log(logLine.trimEnd());
    }

    if (options.logToFile && queryLogFilePath) {
        fs.promises.appendFile(queryLogFilePath, logLine).catch((err) => {
            console.error("Error writing query log to file:", err);
        });
    }
}

// Cron Manager
class CronManager {
    constructor() {
        this.jobs = new Map();
    }

    createJob(name, schedule, task, options = {}) {
        if (this.jobs.has(name)) {
            throw new Error(`Cron job with name '${name}' already exists`);
        }

        // Extract context from options
        const context = options.context;
        const cronOptions = { ...options };
        delete cronOptions.context; // Remove context from cron options

        const wrappedTask = options.isLog
            ? async () => {
                await log(`Running cron job ${name} (cron: "${schedule}")`, "info", import.meta.url);
                await task(context);
            }
            : async () => {
                await task(context);
            };

        const job = cron.createTask(schedule, wrappedTask, {
            name,
            ...cronOptions
        });

        this.jobs.set(name, {
            job,
            name,
            schedule,
            task,
            context,
            options
        });

        return job;
    }

    startJob(name) {
        const jobData = this.jobs.get(name);
        if (!jobData) {
            throw new Error(`Cron job '${name}' not found`);
        }
        jobData.job.start();
        return jobData.job;
    }

    stopJob(name) {
        const jobData = this.jobs.get(name);
        if (!jobData) {
            throw new Error(`Cron job '${name}' not found`);
        }
        jobData.job.stop();
        return jobData.job;
    }

    getJob(name) {
        const jobData = this.jobs.get(name);
        return jobData ? jobData.job : null;
    }

    hasJob(name) {
        return this.jobs.has(name);
    }

    deleteJob(name) {
        const jobData = this.jobs.get(name);
        if (jobData) {
            jobData.job.stop();
            this.jobs.delete(name);
            return true;
        }
        return false;
    }

    startAll() {
        for (const [name, jobData] of this.jobs) {
            jobData.job.start();
        }
    }

    stopAll() {
        for (const [name, jobData] of this.jobs) {
            jobData.job.stop();
        }
    }

    listJobs() {
        return Array.from(this.jobs.keys());
    }
}

export const cronManager = new CronManager();