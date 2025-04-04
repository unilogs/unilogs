function safeAssertString(val: unknown): asserts val is string {
  if (typeof val !== 'string') throw new Error('Expected a string.');
}

export default safeAssertString;