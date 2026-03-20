// TrialShield — Adaptive Challenges Module
// Progressive friction based on risk score

import { ChallengeConfig, ChallengeType } from '@/types';
import { CONFIG } from '@/config';

// ─── Determine Challenge ─────────────────────────────────────
export function determineChallenge(riskScore: number): ChallengeConfig {
    const { challengeTiers } = CONFIG;

    if (riskScore <= challengeTiers.low.max) {
        return {
            type: 'NONE',
            tier: 'LOW',
            actions: ['allow_signup'],
        };
    }

    if (riskScore <= challengeTiers.medium.max) {
        return {
            type: 'INVISIBLE_CAPTCHA',
            tier: 'MEDIUM',
            actions: [
                'show_invisible_captcha',
                'require_email_verification',
            ],
        };
    }

    if (riskScore <= challengeTiers.high.max) {
        return {
            type: 'PHONE_VERIFICATION',
            tier: 'HIGH',
            actions: [
                'require_phone_verification',
                'require_email_verification',
                'show_captcha',
            ],
        };
    }

    return {
        type: 'MANUAL_REVIEW',
        tier: 'CRITICAL',
        actions: [
            'block_signup',
            'flag_for_review',
            'require_identity_verification',
            'notify_admin',
        ],
    };
}

// ─── Challenge Response Descriptions ─────────────────────────
export function getChallengeDescription(config: ChallengeConfig): string {
    switch (config.type) {
        case 'NONE':
            return 'No challenge required — user is low risk.';
        case 'INVISIBLE_CAPTCHA':
            return 'Silent verification — invisible CAPTCHA and email verification required.';
        case 'EMAIL_VERIFICATION':
            return 'Email verification required before account activation.';
        case 'PHONE_VERIFICATION':
            return 'Phone verification via SMS required. Email verification also required.';
        case 'TWO_FACTOR_AUTH':
            return 'Two-factor authentication setup required during signup.';
        case 'CARD_VERIFICATION':
            return 'Credit card $0 authorization required to verify identity.';
        case 'MANUAL_REVIEW':
            return 'Signup blocked — flagged for manual review by admin team.';
        default:
            return 'Unknown challenge type.';
    }
}
