// TrialShield — Client Settings Endpoint (v2)
// GET/PUT /api/v1/settings — Configure sensitivity, thresholds, and monitoring

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashApiKey } from '@/lib/utils';
import { CONFIG } from '@/config';
import { Sensitivity } from '@/types';

// GET — Retrieve current settings for this API key
export async function GET(request: NextRequest) {
    try {
        const apiKey = request.headers.get('X-API-Key') ||
            request.headers.get('Authorization')?.replace('Bearer ', '') || '';
        const apiKeyId = hashApiKey(apiKey);

        const { data } = await supabaseAdmin
            .from('ts_client_settings')
            .select('*')
            .eq('api_key_id', apiKeyId)
            .single();

        if (data) {
            return NextResponse.json({
                sensitivity: data.sensitivity,
                matchThreshold: data.match_threshold,
                autoRevoke: data.auto_revoke,
                notifyWebhook: data.notify_webhook,
                monitorContent: data.monitor_content,
                monitorAiUsage: data.monitor_ai_usage,
                monitorGithub: data.monitor_github,
                presets: CONFIG.matchScoring.presets,
                updatedAt: data.updated_at,
            });
        }

        // Return defaults if no settings exist
        return NextResponse.json({
            sensitivity: 'balanced',
            matchThreshold: CONFIG.matchScoring.presets.balanced,
            autoRevoke: true,
            notifyWebhook: null,
            monitorContent: true,
            monitorAiUsage: true,
            monitorGithub: true,
            presets: CONFIG.matchScoring.presets,
            updatedAt: null,
        });
    } catch (error) {
        console.error('[TrialShield] Settings GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

// PUT — Update settings for this API key
export async function PUT(request: NextRequest) {
    try {
        const apiKey = request.headers.get('X-API-Key') ||
            request.headers.get('Authorization')?.replace('Bearer ', '') || '';
        const apiKeyId = hashApiKey(apiKey);

        const body = await request.json();

        // Validate sensitivity
        const validSensitivities: Sensitivity[] = ['strict', 'balanced', 'lenient', 'custom'];
        if (body.sensitivity && !(validSensitivities as readonly string[]).includes(body.sensitivity)) {
            return NextResponse.json({
                error: `Invalid sensitivity. Must be one of: ${validSensitivities.join(', ')}`,
            }, { status: 400 });
        }

        // Resolve match threshold from preset or custom value
        let matchThreshold = body.matchThreshold;
        if (body.sensitivity && body.sensitivity !== 'custom') {
            matchThreshold = CONFIG.matchScoring.presets[
                body.sensitivity as keyof typeof CONFIG.matchScoring.presets
            ];
        }

        if (matchThreshold !== undefined && (matchThreshold < 0 || matchThreshold > 100)) {
            return NextResponse.json({
                error: 'matchThreshold must be between 0 and 100',
            }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {
            api_key_id: apiKeyId,
            updated_at: new Date().toISOString(),
        };

        if (body.sensitivity !== undefined) updateData.sensitivity = body.sensitivity;
        if (matchThreshold !== undefined) updateData.match_threshold = matchThreshold;
        if (body.autoRevoke !== undefined) updateData.auto_revoke = body.autoRevoke;
        if (body.notifyWebhook !== undefined) updateData.notify_webhook = body.notifyWebhook;
        if (body.monitorContent !== undefined) updateData.monitor_content = body.monitorContent;
        if (body.monitorAiUsage !== undefined) updateData.monitor_ai_usage = body.monitorAiUsage;
        if (body.monitorGithub !== undefined) updateData.monitor_github = body.monitorGithub;

        // Upsert settings
        const { data, error } = await supabaseAdmin
            .from('ts_client_settings')
            .upsert(updateData, { onConflict: 'api_key_id' })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            settings: {
                sensitivity: data.sensitivity,
                matchThreshold: data.match_threshold,
                autoRevoke: data.auto_revoke,
                notifyWebhook: data.notify_webhook,
                monitorContent: data.monitor_content,
                monitorAiUsage: data.monitor_ai_usage,
                monitorGithub: data.monitor_github,
            },
            message: `Settings updated. Sensitivity: ${data.sensitivity} (threshold: ${data.match_threshold}%)`,
        });
    } catch (error) {
        console.error('[TrialShield] Settings PUT error:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}

// CORS
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
        },
    });
}
