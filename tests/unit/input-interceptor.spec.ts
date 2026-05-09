import { describe, expect, it } from 'vitest';
import { InputInterceptor } from '../../src/core/input-interceptor';

describe('InputInterceptor', () => {
  it('captures start-of-line manual rotate commands', () => {
    const interceptor = new InputInterceptor();

    expect(interceptor.push(':rot')).toEqual({ passThrough: '', localEcho: ':rot', rotate: false });
    expect(interceptor.push('ate\r')).toEqual({ passThrough: '', localEcho: 'ate', rotate: true });
  });

  it('passes leading whitespace through immediately', () => {
    const interceptor = new InputInterceptor();

    expect(interceptor.push('  ')).toEqual({ passThrough: '  ', localEcho: '', rotate: false });
    expect(interceptor.push(':rotate\r')).toEqual({ passThrough: ':rotate\r', localEcho: '', rotate: false });
  });

  it('captures rotate after unrelated control bytes', () => {
    const interceptor = new InputInterceptor();

    expect(interceptor.push('\u000f\u0000')).toEqual({ passThrough: '\u000f\u0000', localEcho: '', rotate: false });
    expect(interceptor.push(':rotate\r')).toEqual({ passThrough: '', localEcho: ':rotate', rotate: true });
  });

  it('passes escaped rotate commands through literally', () => {
    const interceptor = new InputInterceptor();

    expect(interceptor.push('\\:rotate\r')).toEqual({ passThrough: '\\:rotate\r', localEcho: '', rotate: false });
  });

  it('flushes non-rotate colon-prefixed input to Devin without dropping the colon', () => {
    const interceptor = new InputInterceptor();

    expect(interceptor.push(':')).toEqual({ passThrough: '', localEcho: ':', rotate: false });
    expect(interceptor.push('f')).toEqual({ passThrough: ':f', localEcho: '\b \b', rotate: false });
    expect(interceptor.push('oo\r')).toEqual({ passThrough: 'oo\r', localEcho: '', rotate: false });
  });

  it('does not locally echo whitespace while waiting for a rotate candidate', () => {
    const interceptor = new InputInterceptor();

    expect(interceptor.push('  :nope\r')).toEqual({
      passThrough: '  :nope\r',
      localEcho: '',
      rotate: false
    });
  });

  it('does not let terminal control responses consume line start', () => {
    const interceptor = new InputInterceptor();

    expect(interceptor.push('\u001b[24;1R')).toEqual({ passThrough: '\u001b[24;1R', localEcho: '', rotate: false });
    expect(interceptor.push('\u001b[?1;2c')).toEqual({ passThrough: '\u001b[?1;2c', localEcho: '', rotate: false });
    expect(interceptor.push(':rotate\r')).toEqual({ passThrough: '', localEcho: ':rotate', rotate: true });
  });

  it('handles split terminal control responses before rotate', () => {
    const interceptor = new InputInterceptor();

    expect(interceptor.push('\u001b')).toEqual({ passThrough: '\u001b', localEcho: '', rotate: false });
    expect(interceptor.push('[24;1R')).toEqual({ passThrough: '[24;1R', localEcho: '', rotate: false });
    expect(interceptor.push(':rotate\r')).toEqual({ passThrough: '', localEcho: ':rotate', rotate: true });
  });

  it('does not let OSC terminal responses consume line start', () => {
    const interceptor = new InputInterceptor();

    expect(interceptor.push('\u001b]10;rgb:ffff/ffff/ffff\u0007')).toEqual({
      passThrough: '\u001b]10;rgb:ffff/ffff/ffff\u0007',
      rotate: false,
      localEcho: ''
    });
    expect(interceptor.push('\u001b]11;rgb:0000/0000/0000\u001b\\')).toEqual({
      passThrough: '\u001b]11;rgb:0000/0000/0000\u001b\\',
      rotate: false,
      localEcho: ''
    });
    expect(interceptor.push(':rotate\r')).toEqual({ passThrough: '', localEcho: ':rotate', rotate: true });
  });

  it('handles backspace-corrected rotate input followed by a bare escape before enter', () => {
    const interceptor = new InputInterceptor();

    expect(interceptor.push('\u001b')).toEqual({ passThrough: '\u001b', localEcho: '', rotate: false });
    expect(interceptor.push('\u001b')).toEqual({ passThrough: '\u001b', localEcho: '', rotate: false });
    expect(interceptor.push(':')).toEqual({ passThrough: '', localEcho: ':', rotate: false });
    expect(interceptor.push('r')).toEqual({ passThrough: '', localEcho: 'r', rotate: false });
    expect(interceptor.push('\u007fro')).toEqual({ passThrough: '', localEcho: '\u007fro', rotate: false });
    expect(interceptor.push('\u007f\u007frot')).toEqual({ passThrough: '', localEcho: '\u007f\u007frot', rotate: false });
    expect(interceptor.push('\u007f\u007f')).toEqual({ passThrough: '', localEcho: '\u007f\u007f', rotate: false });
    expect(interceptor.push('\u007frota')).toEqual({ passThrough: '', localEcho: '\u007frota', rotate: false });
    expect(interceptor.push('\u007f')).toEqual({ passThrough: '', localEcho: '\u007f', rotate: false });
    expect(interceptor.push('\u007f\u007f\u007frotat')).toEqual({ passThrough: '', localEcho: '\u007f\u007f\u007frotat', rotate: false });
    expect(interceptor.push('\u007f')).toEqual({ passThrough: '', localEcho: '\u007f', rotate: false });
    expect(interceptor.push('\u007f\u007f\u007f\u007frotate')).toEqual({
      passThrough: '',
      rotate: false,
      localEcho: '\u007f\u007f\u007f\u007frotate'
    });
    expect(interceptor.push('\u001b')).toEqual({ passThrough: '\u001b', localEcho: '', rotate: false });
    expect(interceptor.push('\r')).toEqual({ passThrough: '', localEcho: '', rotate: true });
  });

  it('passes through backspaces for normal Devin input down to empty line', () => {
    const interceptor = new InputInterceptor();

    expect(interceptor.push('abc')).toEqual({ passThrough: 'abc', localEcho: '', rotate: false });
    expect(interceptor.push('\u007f')).toEqual({ passThrough: '\u007f', localEcho: '', rotate: false });
    expect(interceptor.push('\u007f')).toEqual({ passThrough: '\u007f', localEcho: '', rotate: false });
    expect(interceptor.push('\u007f')).toEqual({ passThrough: '\u007f', localEcho: '', rotate: false });
    expect(interceptor.push('bcd')).toEqual({ passThrough: 'bcd', localEcho: '', rotate: false });
    expect(interceptor.push('\u007f\u007f\u007f')).toEqual({ passThrough: '\u007f\u007f\u007f', localEcho: '', rotate: false });
  });
});
