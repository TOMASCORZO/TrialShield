// TrialShield — SDK Serve Endpoint
// GET /api/v1/sdk — Serves the TrialShield SDK with proper CORS and caching headers
// Clients embed: <script src="https://your-trialshield.com/api/v1/sdk?key=ts_xxx"></script>

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

let cachedSDK: string | null = null;

export async function GET(request: NextRequest) {
    try {
        // Load SDK file (cached in memory after first load)
        if (!cachedSDK) {
            const sdkPath = join(process.cwd(), 'public', 'sdk', 'trialshield.js');
            cachedSDK = readFileSync(sdkPath, 'utf-8');
        }

        // Get the API key from query string (for auto-init)
        const apiKey = request.nextUrl.searchParams.get('key') || '';
        const autoInit = request.nextUrl.searchParams.get('auto') !== 'false';

        // Build the SDK response with auto-init
        let sdkContent = cachedSDK;

        if (autoInit && apiKey) {
            // Append auto-initialization code
            const origin = request.headers.get('origin') || request.nextUrl.origin;
            sdkContent += `\n\n// ─── Auto-Init ──────────────────────────────\n`;
            sdkContent += `(function() {\n`;
            sdkContent += `  if (typeof window !== 'undefined' && window.TrialShield) {\n`;
            sdkContent += `    window.__ts = new TrialShield({\n`;
            sdkContent += `      apiKey: '${apiKey.replace(/'/g, "\\'")}',\n`;
            sdkContent += `      apiUrl: '${request.nextUrl.origin}'\n`;
            sdkContent += `    });\n`;
            sdkContent += `    console.log('[TrialShield] SDK auto-initialized — ready to verify');\n`;
            sdkContent += `  }\n`;
            sdkContent += `})();\n`;
        }

        return new NextResponse(sdkContent, {
            status: 200,
            headers: {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Cache-Control': 'public, max-age=3600, s-maxage=86400',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error) {
        console.error('[TrialShield] SDK serve error:', error);
        return new NextResponse('// TrialShield SDK failed to load', {
            status: 500,
            headers: { 'Content-Type': 'application/javascript' },
        });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        },
    });
}
