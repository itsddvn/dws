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

  it('ignores terminal control responses after a submitted prompt', () => {
    const capture = new PromptCapture();

    capture.push('retry this\r');
    capture.push('\u001b[24;1R');
    capture.push('\u001b]10;rgb:ffff/ffff/ffff\u0007');

    expect(capture.consumeReplayCandidate()).toBe('retry this');
  });
});
