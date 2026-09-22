import { describe, expect, it } from 'vitest';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor (unit)', () => {
  const interceptor = new ResponseInterceptor();
  const context = {} as ExecutionContext;

  const run = (data: unknown): Promise<unknown> => {
    const next: CallHandler = { handle: () => of(data) };
    return lastValueFrom(interceptor.intercept(context, next));
  };

  describe('envelope wrapping', () => {
    it('wraps a plain object payload as { ok: true, data }', async () => {
      const result = await run({ id: 1, title: 'El jardín de las mariposas' });
      expect(result).toEqual({ ok: true, data: { id: 1, title: 'El jardín de las mariposas' } });
    });

    it('wraps an array payload as { ok: true, data }', async () => {
      const result = await run([1, 2, 3]);
      expect(result).toEqual({ ok: true, data: [1, 2, 3] });
    });

    it('wraps a primitive payload', async () => {
      const result = await run('raw string');
      expect(result).toEqual({ ok: true, data: 'raw string' });
    });
  });

  describe('passthrough (no envelope)', () => {
    it.each([null, undefined])('passes %p through untouched', async (value) => {
      const result = await run(value);
      expect(result).toBe(value);
    });

    it('passes streamable payloads (CSV / @Res writes) through untouched', async () => {
      const streamable = { __streamable__: true, raw: 'csv' };
      const result = await run(streamable);
      expect(result).toBe(streamable);
    });
  });
});