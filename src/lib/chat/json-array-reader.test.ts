/// <reference types="bun" />

import { describe, expect, test } from 'bun:test';

import { JsonArrayReader } from '@/lib/chat/json-array-reader';

describe('JsonArrayReader', () => {
  test('gives back each element of a whole array', () => {
    expect(new JsonArrayReader().push('[{"a":1},{"b":[2,3]}]')).toEqual([{ a: 1 }, { b: [2, 3] }]);
  });

  test('waits for an element split across pieces', () => {
    const reader = new JsonArrayReader();
    expect(reader.push('[{"items":[{"id"')).toEqual([]);
    expect(reader.push(':"x"}],"next')).toEqual([]);
    expect(reader.push('PageToken":"t1"}\n,')).toEqual([{ items: [{ id: 'x' }], nextPageToken: 't1' }]);
    expect(reader.push('{"items":[]}')).toEqual([{ items: [] }]);
  });

  test('ignores brackets, quotes and backslashes inside strings', () => {
    const text = 'a "quoted" {brace} [bracket] \\ end';
    expect(new JsonArrayReader().push(`[${JSON.stringify({ text })}]`)).toEqual([{ text }]);
  });

  test('handles a piece ending right after a backslash', () => {
    const reader = new JsonArrayReader();
    expect(reader.push('[{"text":"say \\')).toEqual([]);
    expect(reader.push('"hi\\"!"}]')).toEqual([{ text: 'say "hi"!' }]);
  });

  test('reads an error answer, which comes the same way', () => {
    expect(new JsonArrayReader().push('[{\n  "error": {\n    "code": 403,\n    "message": "Permission denied."\n  }\n}\n]')).toEqual([
      { error: { code: 403, message: 'Permission denied.' } },
    ]);
  });
});
