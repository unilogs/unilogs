import hash_sum from 'hash-sum';
import path from 'path';

export function getLocalDir(logPath: string) {
  return path.dirname(logPath);
}
export function getInternalDir(logPath: string) {
  const hashedDir = hash_sum(path.dirname(logPath));
  return `/logs_${hashedDir}`;
}
export function getBase(logPath: string) {
  return path.basename(logPath);
}
