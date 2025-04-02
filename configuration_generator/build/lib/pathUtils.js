import hash_sum from 'hash-sum';
import path from 'path';
export function getLocalDir(logPath) {
    return path.dirname(logPath);
}
export function getInternalDir(logPath) {
    const hashedDir = hash_sum(path.dirname(logPath));
    return `/logs_${hashedDir}`;
}
export function getBase(logPath) {
    return path.basename(logPath);
}
