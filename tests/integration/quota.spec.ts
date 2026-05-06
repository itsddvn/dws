import { describe, expect, it } from 'vitest';
import { normalizeQuotaPayload } from '../../src/core/quota/endpoint';

describe('quota endpoint contract fixture', () => {
  it('normalizes recorded PlanStatus-style quota payloads and redacts tokens', () => {
    const snapshot = normalizeQuotaPayload({
      dailyRemainingPct: 42.5,
      weeklyRemainingPct: 75,
      dailyResetAt: '2026-05-07T00:00:00.000Z',
      weeklyResetAt: 1_778_716_800_000,
      usedPromptCredits: 10,
      availablePromptCredits: 90,
      usedFlowCredits: '4',
      availableFlowCredits: '16',
      token: 'devin-session-token$secret'
    });

    expect(snapshot.daily_remaining_pct).toBe(42.5);
    expect(snapshot.weekly_remaining_pct).toBe(75);
    expect(snapshot.daily_reset_at).toBe(1_778_112_000);
    expect(snapshot.weekly_reset_at).toBe(1_778_716_800);
    expect(snapshot.used_flow_credits).toBe(4);
    expect(snapshot.raw_json).not.toContain('secret');
    expect(snapshot.raw_json).toContain('[REDACTED]');
  });
});
