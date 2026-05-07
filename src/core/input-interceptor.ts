export interface InterceptResult {
  passThrough: string;
  localEcho: string;
  rotate: boolean;
}

export interface InputInterceptorOptions {
  onDebugChunk?: (data: string) => void;
}

export class InputInterceptor {
  private line = '';
  private escapeMode: 'esc' | 'csi' | 'osc' | null = null;
  private oscSawEscape = false;

  constructor(private readonly options: InputInterceptorOptions = {}) {}

  push(data: string): InterceptResult {
    this.options.onDebugChunk?.(data);
    let passThrough = '';
    let localEcho = '';
    let rotate = false;

    for (const char of data) {
      if (this.escapeMode) {
        if (this.escapeMode === 'esc' && (char === '\r' || char === '\n')) {
          this.escapeMode = null;
          this.oscSawEscape = false;
        } else {
          passThrough += char;
          this.advanceEscape(char);
          continue;
        }
      }

      if (char === '\u001b') {
        passThrough += char;
        this.escapeMode = 'esc';
        continue;
      }

      if (char === '\r' || char === '\n') {
        if (this.line.trim() === ':rotate') {
          this.resetLine();
          rotate = true;
          continue;
        }
        passThrough += char;
        this.resetLine();
        continue;
      }

      if (isBackspace(char)) {
        const wasLocalCommandCandidate = isLocalCommandCandidate(this.line);
        this.line = this.line.slice(0, -1);
        if (wasLocalCommandCandidate) localEcho += char;
        else passThrough += char;
        continue;
      }

      if (isIgnorableControl(char)) {
        passThrough += char;
        continue;
      }

      this.line += char;
      if (isLocalCommandCandidate(this.line)) localEcho += char;
      else passThrough += char;
    }

    return { passThrough, localEcho, rotate };
  }

  private resetLine(): void {
    this.line = '';
  }

  private advanceEscape(char: string): void {
    if (this.escapeMode === 'esc') {
      if (char === '[') {
        this.escapeMode = 'csi';
        return;
      }
      if (char === ']') {
        this.escapeMode = 'osc';
        this.oscSawEscape = false;
        return;
      }
      this.escapeMode = null;
      return;
    }

    if (this.escapeMode === 'csi') {
      if (isCsiFinalByte(char)) this.escapeMode = null;
      return;
    }

    if (this.escapeMode === 'osc') {
      if (this.oscSawEscape) {
        this.escapeMode = char === '\\' ? null : 'osc';
        this.oscSawEscape = false;
        return;
      }
      if (char === '\u0007') {
        this.escapeMode = null;
        return;
      }
      if (char === '\u001b') this.oscSawEscape = true;
    }
  }
}

function isCsiFinalByte(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x40 && code <= 0x7e;
}

function isIgnorableControl(char: string): boolean {
  const code = char.charCodeAt(0);
  return code < 0x20 || code === 0x7f;
}

function isBackspace(char: string): boolean {
  return char === '\b' || char === '\u007f';
}

function isLocalCommandCandidate(value: string): boolean {
  const trimmedStart = value.trimStart();
  return ':rotate'.startsWith(trimmedStart);
}
