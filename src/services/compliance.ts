// TrialShield — Compliance & Privacy Module
// GDPR, CCPA, LGPD compliant data handling

import { AuditLog } from '@/types';
import { supabaseAdmin } from '@/lib/supabase';
import { sha256 } from '@/lib/utils';

// ─── Audit Logging ───────────────────────────────────────────
export async function logAuditEvent(
    apiKeyId: string,
    endpoint: string,
    method: string,
    requestBody: Record<string, unknown>,
    responseDecision: string,
    responseScore: number,
    ipAddress: string,
    processingTimeMs: number
): Promise<void> {
    try {
        // Sanitize request body — hash PII before logging
        const sanitizedBody = sanitizeForAudit(requestBody);

        await supabaseAdmin.from('ts_audit_logs').insert({
            api_key_id: apiKeyId,
            endpoint,
            method,
            request_body: sanitizedBody,
            response_decision: responseDecision,
            response_score: responseScore,
            ip_address: sha256(ipAddress),
            processing_time_ms: processingTimeMs,
        });
    } catch (error) {
        console.error('[TrialShield] Audit log failed:', error);
    }
}

// ─── Data Sanitization ───────────────────────────────────────
function sanitizeForAudit(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...data };

    // Hash email if present
    if (typeof sanitized.email === 'string') {
        sanitized.email = sha256(sanitized.email);
        sanitized.email_hashed = true;
    }

    // Hash phone if present
    if (typeof sanitized.phone === 'string') {
        sanitized.phone = sha256(sanitized.phone);
        sanitized.phone_hashed = true;
    }

    // Hash IP if present
    if (typeof sanitized.ip === 'string') {
        sanitized.ip = sha256(sanitized.ip);
        sanitized.ip_hashed = true;
    }

    return sanitized;
}

// ─── GDPR Delete Request ─────────────────────────────────────
export async function handleDeleteRequest(identifier: string, type: 'email' | 'phone' | 'user_id'): Promise<{
    success: boolean;
    deletedRecords: number;
    message: string;
}> {
    try {
        let userId: string | null = null;
        let deletedRecords = 0;

        if (type === 'user_id') {
            userId = identifier;
        } else {
            const hash = sha256(identifier);
            const field = type === 'email' ? 'email_hash' : 'phone_hash';

            const { data } = await supabaseAdmin
                .from('ts_users')
                .select('id')
                .eq(field, hash)
                .single();

            userId = data?.id || null;
        }

        if (!userId) {
            return { success: true, deletedRecords: 0, message: 'No data found for this identifier.' };
        }

        // Delete in order: monitor_events → device_graph → risk_events → velocity → users
        const tables = ['ts_monitor_events', 'ts_device_graph', 'ts_risk_events'] as const;
        for (const table of tables) {
            const { data: rows } = await supabaseAdmin
                .from(table)
                .select('id')
                .eq('user_id', userId);
            if (rows && rows.length > 0) {
                await supabaseAdmin.from(table).delete().eq('user_id', userId);
                deletedRecords += rows.length;
            }
        }

        // Delete velocity records
        const { data: velocityRows } = await supabaseAdmin
            .from('ts_velocity')
            .select('id')
            .eq('identifier_value', sha256(identifier));
        if (velocityRows && velocityRows.length > 0) {
            await supabaseAdmin.from('ts_velocity').delete().eq('identifier_value', sha256(identifier));
            deletedRecords += velocityRows.length;
        }

        await supabaseAdmin.from('ts_users').delete().eq('id', userId);
        deletedRecords += 1;

        // Log the deletion itself
        await logAuditEvent(
            'SYSTEM', '/compliance/delete', 'DELETE',
            { type, identifier_hash: sha256(identifier) },
            'DELETED', 0, '0.0.0.0', 0
        );

        return {
            success: true,
            deletedRecords,
            message: `Successfully deleted ${deletedRecords} records for user.`,
        };
    } catch (error) {
        console.error('[TrialShield] Delete request failed:', error);
        return { success: false, deletedRecords: 0, message: 'Delete request failed.' };
    }
}

// ─── Audit Log Queries ───────────────────────────────────────
export async function getAuditLogs(options: {
    limit?: number;
    offset?: number;
    apiKeyId?: string;
    startDate?: string;
    endDate?: string;
}): Promise<{ logs: AuditLog[]; total: number }> {
    try {
        let query = supabaseAdmin.from('ts_audit_logs').select('*', { count: 'exact' });

        if (options.apiKeyId) {
            query = query.eq('api_key_id', options.apiKeyId);
        }
        if (options.startDate) {
            query = query.gte('created_at', options.startDate);
        }
        if (options.endDate) {
            query = query.lte('created_at', options.endDate);
        }

        query = query
            .order('created_at', { ascending: false })
            .range(options.offset || 0, (options.offset || 0) + (options.limit || 50) - 1);

        const { data, count } = await query;

        return {
            logs: (data || []) as unknown as AuditLog[],
            total: count || 0,
        };
    } catch {
        return { logs: [], total: 0 };
    }
}

// ─── Data Export (GDPR) ──────────────────────────────────────
export async function exportUserData(identifier: string, type: 'email' | 'phone'): Promise<Record<string, unknown>> {
    try {
        const hash = sha256(identifier);
        const field = type === 'email' ? 'email_hash' : 'phone_hash';

        const { data: user } = await supabaseAdmin
            .from('ts_users')
            .select('*')
            .eq(field, hash)
            .single();

        if (!user) return { message: 'No data found' };

        const { data: riskEvents } = await supabaseAdmin
            .from('ts_risk_events')
            .select('*')
            .eq('user_id', user.id);

        const { data: deviceLinks } = await supabaseAdmin
            .from('ts_device_graph')
            .select('*')
            .eq('user_id', user.id);

        return {
            user: { ...user, [field]: '[HASHED]' },
            riskEvaluations: (riskEvents || []).length,
            deviceLinks: (deviceLinks || []).length,
            exportedAt: new Date().toISOString(),
            note: 'All PII is stored in hashed form. Original values are not retrievable.',
        };
    } catch {
        return { error: 'Export failed' };
    }
}
