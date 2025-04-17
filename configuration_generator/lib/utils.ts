import hash_sum from 'hash-sum';
import path from 'path';
import fs from 'fs';

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

export function writeDockerCommand(command: string) {
  const json = JSON.stringify({
    command
  });
  
  fs.writeFile('./dockerCommand.json', json, err => {
    if (err) {
      console.log('Had a problem writing `dockerCommand.json`');
    }
  });
}

export function readDockerCommand(): string {
  const data =  fs.readFileSync('./dockerCommand.json', 'utf8')
  const obj: unknown = JSON.parse(data);

  if (obj && typeof obj === 'object' && 'command' in obj && typeof obj.command === 'string') {
    return obj.command;
  } else {
    throw new Error('Error parsing dockerCommand.json');
  }
}
