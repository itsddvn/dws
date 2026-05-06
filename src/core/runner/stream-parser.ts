import { classifySignal, type AccountSignal, type SignalDecision } from '../quota/signals';

const MAX_LINE_LENGTH = 16 * 1024;

export class StreamSignalParser {
  private readonly decisions: SignalDecision[] = [];
  private finishReason: string | null = null;

  ingestLine(line: string): void {
    const bounded = line.length > MAX_LINE_LENGTH ? line.slice(0, MAX_LINE_LENGTH) : line;
    this.record({ type: 'output_line', value: bounded });

    const finishReason = extractFinishReason(bounded);
    if (finishReason) {
      this.finishReason = finishReason;
      this.record({ type: 'finish_reason', value: finishReason });
    }
  }

  ingestExit(code: number | null): void {
    this.record({ type: 'exit', code });
  }

  getDecisions(): SignalDecision[] {
    return [...this.decisions];
  }

  getPrimaryDecision(): SignalDecision {
    return (
      this.decisions.find((decision) => decision.kind === 'limited' || decision.kind === 'needs_login') ??
      this.decisions.find((decision) => decision.kind === 'cooldown') ??
      { kind: 'none' }
    );
  }

  getFinishReason(): string | null {
    return this.finishReason;
  }

  private record(signal: AccountSignal): void {
    const decision = classifySignal(signal);
    if (decision.kind !== 'none') {
      this.decisions.push(decision);
    }
  }
}

function extractFinishReason(line: string): string | undefined {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (parsed && typeof parsed === 'object' && 'finish_reason' in parsed) {
      const value = (parsed as { finish_reason?: unknown }).finish_reason;
      return typeof value === 'string' ? value : undefined;
    }
    if (parsed && typeof parsed === 'object' && 'params' in parsed) {
      const params = (parsed as { params?: unknown }).params;
      if (params && typeof params === 'object' && 'finish_reason' in params) {
        const value = (params as { finish_reason?: unknown }).finish_reason;
        return typeof value === 'string' ? value : undefined;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}
