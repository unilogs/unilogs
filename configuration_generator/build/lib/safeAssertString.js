function safeAssertString(val) {
    if (typeof val !== 'string')
        throw new Error('Expected a string.');
}
export default safeAssertString;
