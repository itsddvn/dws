import { describe, expect, it } from 'vitest';
import { parseUsageOutput } from '../../src/core/quota';

describe('parseUsageOutput', () => {
  it('parses percentages and credit pairs from a typical /usage output', () => {
    const output = [
      'Usage report:',
      '  Daily quota: 60% remaining',
      '  Weekly quota: 80% remaining',
      '  Prompt credits used: 100/500',
      '  Flow credits used: 20/200',
      '  Flex credits used: 5/50'
    ].join('\n');

    const snapshot = parseUsageOutput(output);
    expect(snapshot.dailyRemainingPct).toBe(60);
    expect(snapshot.weeklyRemainingPct).toBe(80);
    expect(snapshot.usedPromptCredits).toBe(100);
    expect(snapshot.availablePromptCredits).toBe(400);
    expect(snapshot.usedFlowCredits).toBe(20);
    expect(snapshot.availableFlowCredits).toBe(180);
    expect(snapshot.usedFlexCredits).toBe(5);
    expect(snapshot.availableFlexCredits).toBe(45);
  });

  it('falls back to used/total for percentage when "remaining" is missing', () => {
    const output = 'Daily: 50/200';
    const snapshot = parseUsageOutput(output);
    expect(snapshot.dailyRemainingPct).toBe(75);
  });

  it('returns null fields when nothing parseable is present', () => {
    const snapshot = parseUsageOutput('No usage data available right now.');
    expect(snapshot.dailyRemainingPct).toBeNull();
    expect(snapshot.weeklyRemainingPct).toBeNull();
    expect(snapshot.usedPromptCredits).toBeNull();
  });
});
