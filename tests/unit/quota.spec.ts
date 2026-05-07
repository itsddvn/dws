import { describe, expect, it } from 'vitest';
import { parseQuotaSummary } from '../../src/core/quota';

describe('parseQuotaSummary', () => {
  it('parses real Devin /usage output', () => {
    const summary = parseQuotaSummary(`
Trial · 100% remaining (resets in 5h 41m)

Fetching quota...

Quota used: 0% (remaining: 100%)
Quota resets May 7, 3:00 PM (UTC+7).
`);

    expect(summary).toEqual({
      tier: 'Trial',
      usedPercent: '0%',
      remainingPercent: '100%',
      resetsIn: '5h 41m',
      resetAt: 'May 7, 3:00 PM (UTC+7)'
    });
  });

  it('falls back to headline remaining percent when detailed line is absent', () => {
    const summary = parseQuotaSummary('Pro - 75% remaining (resets in 1d 2h)');

    expect(summary).toMatchObject({
      tier: 'Pro',
      remainingPercent: '75%',
      resetsIn: '1d 2h'
    });
  });

  it('parses quota exhausted output as zero remaining', () => {
    const summary = parseQuotaSummary(
      'Error: Agent error: Your daily usage quota has been exhausted. Visit https://app.devin.ai/plans to manage your plan.'
    );

    expect(summary.usedPercent).toBe('100%');
    expect(summary.remainingPercent).toBe('0%');
  });
});
