// ============================================================
// Streaming usage parsing helpers — CPU-budget fast path
// ============================================================

import { describe, it, expect, afterEach } from 'vitest';
import {
  chunkHasUsage,
  jsonStringFieldLength,
  createByteCountingStream,
  estimateCompletionTokensFromStreamBytes,
} from '@/lib/usage/stream-usage';

/** Build a ReadableStream that emits the given Uint8Array chunks in order. */
function streamFromChunks(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++]);
      } else {
        controller.close();
      }
    },
  });
}

/** Drain a stream and return the concatenated bytes it passed through. */
async function drain(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const out: number[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) out.push(...value);
  }
  return new Uint8Array(out);
}

describe('stream-usage helpers', () => {
  describe('chunkHasUsage', () => {
    it('returns false for OpenAI content delta chunks (no token fields)', () => {
      const delta = JSON.stringify({
        choices: [{ delta: { content: 'const x = 1;' } }],
        usage: null,
      });
      // include_usage injects "usage": null on every content chunk —
      // the gate must NOT trip on that, only on real *_tokens fields.
      expect(chunkHasUsage(delta)).toBe(false);
    });

    it('returns true for the final OpenAI usage chunk', () => {
      const usageChunk = JSON.stringify({
        choices: [],
        usage: { prompt_tokens: 17, completion_tokens: 42, total_tokens: 59 },
      });
      expect(chunkHasUsage(usageChunk)).toBe(true);
    });

    it('returns false for Anthropic content_block_delta', () => {
      const delta = JSON.stringify({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'function foo() {}' },
      });
      expect(chunkHasUsage(delta)).toBe(false);
    });

    it('returns true for Anthropic message_start and message_delta', () => {
      const start = JSON.stringify({
        type: 'message_start',
        message: { usage: { input_tokens: 10, output_tokens: 1 } },
      });
      const delta = JSON.stringify({
        type: 'message_delta',
        usage: { output_tokens: 99 },
      });
      expect(chunkHasUsage(start)).toBe(true);
      expect(chunkHasUsage(delta)).toBe(true);
    });

    it('returns false for Responses output_text.delta and true on completion', () => {
      const textDelta = JSON.stringify({
        type: 'response.output_text.delta',
        delta: 'class A {}',
      });
      const completed = JSON.stringify({
        type: 'response.completed',
        response: { usage: { input_tokens: 5, output_tokens: 8 } },
      });
      expect(chunkHasUsage(textDelta)).toBe(false);
      expect(chunkHasUsage(completed)).toBe(true);
    });
  });

  describe('jsonStringFieldLength', () => {
    it('measures a plain string field length without JSON.parse', () => {
      const data = JSON.stringify({ choices: [{ delta: { content: 'hello world' } }] });
      expect(jsonStringFieldLength(data, 'content')).toBe('hello world'.length);
    });

    it('matches the parsed length for the Responses delta field', () => {
      const text = 'export const value = 42;';
      const data = JSON.stringify({ type: 'response.output_text.delta', delta: text });
      expect(jsonStringFieldLength(data, 'delta')).toBe(text.length);
    });

    it('returns 0 when the field is absent', () => {
      const data = JSON.stringify({ type: 'ping' });
      expect(jsonStringFieldLength(data, 'content')).toBe(0);
    });

    it('returns 0 when the field is null (not a string)', () => {
      const data = JSON.stringify({ content: null });
      expect(jsonStringFieldLength(data, 'content')).toBe(0);
    });

    it('counts an escaped quote/backslash as a single character and stops at the closing quote', () => {
      // Raw JSON: {"text":"a\"b","other":"x"}
      const raw = '{"text":"a\\"b","other":"x"}';
      // The decoded value is a"b → 3 chars; scanner counts the escape pair as one.
      expect(jsonStringFieldLength(raw, 'text')).toBe(3);
    });

    it('does not bleed past the field into later fields', () => {
      const data = JSON.stringify({ delta: 'short', tail: 'this should not be counted' });
      expect(jsonStringFieldLength(data, 'delta')).toBe('short'.length);
    });
  });

  describe('estimateCompletionTokensFromStreamBytes', () => {
    const ENV_KEY = 'RELAY_STREAM_BYTES_PER_TOKEN';
    afterEach(() => {
      delete process.env[ENV_KEY];
    });

    it('returns 0 for a zero or negative byte count', () => {
      expect(estimateCompletionTokensFromStreamBytes(0)).toBe(0);
      expect(estimateCompletionTokensFromStreamBytes(-100)).toBe(0);
    });

    it('estimates with the default divisor (20 bytes/token)', () => {
      expect(estimateCompletionTokensFromStreamBytes(2000)).toBe(100);
    });

    it('never returns less than 1 for a non-empty body', () => {
      // A few bytes is still at least one token, not rounded down to zero.
      expect(estimateCompletionTokensFromStreamBytes(3)).toBe(1);
    });

    it('honours the RELAY_STREAM_BYTES_PER_TOKEN override', () => {
      process.env[ENV_KEY] = '10';
      expect(estimateCompletionTokensFromStreamBytes(2000)).toBe(200);
    });

    it('falls back to the default for an invalid override', () => {
      process.env[ENV_KEY] = 'not-a-number';
      expect(estimateCompletionTokensFromStreamBytes(2000)).toBe(100);
      process.env[ENV_KEY] = '0';
      expect(estimateCompletionTokensFromStreamBytes(2000)).toBe(100);
    });
  });

  describe('createByteCountingStream', () => {
    it('passes every chunk through unchanged', async () => {
      const enc = new TextEncoder();
      const chunks = [enc.encode('data: a\n\n'), enc.encode('data: bb\n\n'), enc.encode('data: [DONE]\n\n')];
      const passed = await drain(createByteCountingStream(streamFromChunks(chunks), () => {}));
      const expected = enc.encode('data: a\n\ndata: bb\n\ndata: [DONE]\n\n');
      expect(passed).toEqual(expected);
    });

    it('reports the total byte length to onDone after the stream ends', async () => {
      const enc = new TextEncoder();
      const chunks = [enc.encode('hello'), enc.encode(' '), enc.encode('world')];
      const total = chunks.reduce((n, c) => n + c.byteLength, 0);
      let reported = -1;
      await drain(createByteCountingStream(streamFromChunks(chunks), (bytes) => { reported = bytes; }));
      expect(reported).toBe(total);
    });

    it('awaits an async onDone before closing', async () => {
      let settled = false;
      await drain(createByteCountingStream(streamFromChunks([new Uint8Array([1, 2, 3])]), async () => {
        await Promise.resolve();
        settled = true;
      }));
      expect(settled).toBe(true);
    });

    it('swallows errors thrown by onDone so the stream still closes', async () => {
      // onDone is best-effort usage recording — a failure there must not surface
      // as a stream error to the client.
      const passed = await drain(createByteCountingStream(streamFromChunks([new Uint8Array([9])]), () => {
        throw new Error('record failed');
      }));
      expect(passed).toEqual(new Uint8Array([9]));
    });

    it('reports zero bytes for an empty stream', async () => {
      let reported = -1;
      await drain(createByteCountingStream(streamFromChunks([]), (bytes) => { reported = bytes; }));
      expect(reported).toBe(0);
    });
  });
});
