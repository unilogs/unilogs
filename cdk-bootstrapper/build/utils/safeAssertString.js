"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function safeAssertString(val) {
    if (typeof val !== 'string')
        throw new Error('Expected a string.');
}
exports.default = safeAssertString;
