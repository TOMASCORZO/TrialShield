// TrialShield — Structured logger
// JSON output in production so logs are machine-parseable in Vercel / Datadog / Logtail.
// Pretty output in development.
//
// To wire Sentry later: `npm install @sentry/nextjs`, then in this file's `dispatch`
// branch for `level === 'error'`, call `Sentry.captureException(payload.error)`.

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
    [key: string]: unknown;
}

const isProd = process.env.NODE_ENV === 'production';

function dispatch(level: LogLevel, event: string, context: LogContext, error?: unknown) {
    const payload: Record<string, unknown> = {
        level,
        event,
        ts: new Date().toISOString(),
        ...context,
    };

    if (error instanceof Error) {
        payload.error = {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    } else if (error !== undefined) {
        payload.error = error;
    }

    const line = isProd ? JSON.stringify(payload) : prettyFormat(payload);

    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
}

function prettyFormat(payload: Record<string, unknown>): string {
    const { level, event, ts, error, ...rest } = payload;
    const restStr = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
    const errStr = error ? `\n  ${JSON.stringify(error)}` : '';
    return `[${ts}] ${String(level).toUpperCase()} ${event}${restStr}${errStr}`;
}

export function logInfo(event: string, context: LogContext = {}) {
    dispatch('info', event, context);
}

export function logWarn(event: string, context: LogContext = {}) {
    dispatch('warn', event, context);
}

export function logError(event: string, error: unknown, context: LogContext = {}) {
    dispatch('error', event, context, error);
}
