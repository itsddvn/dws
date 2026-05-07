import { describe, expect, it } from 'vitest';
import { PromptCapture } from '../../src/core/prompt-capture';

describe('PromptCapture', () => {
  it('captures safe submitted single-line prompts', () => {
    const capture = new PromptCapture();

    capture.push('fix the failing test\r');

    expect(capture.consumeReplayCandidate()).toBe('fix the failing test');
    expect(capture.consumeReplayCandidate()).toBeNull();
  });

  it('does not replay slash commands', () => {
    const capture = new PromptCapture();

    capture.push('/usage\r');

    expect(capture.consumeReplayCandidate()).toBeNull();
  });
});
