import { Worker, Job } from 'bullmq';
import { redisConnection } from './redis-connection';
import pg from 'pg';

const { Pool } = pg;

const db = new Pool({
  connectionString: 'postgresql://postgres:secret@localhost:5469/unilogs_prepod',
});

// define object shape for every custom log transformation
interface TransformedLog0 {
  time: any,
  level: any,
  original_log: string
}

// test transformation function given 0, increment for each custom func
const transformLog0 = (log: any): TransformedLog0 => {
  return {
    time: log.time || new Date().toISOString(),
    level: log.level || 'info',
    original_log: 'REDACTED',
  };
};

const logWorker = new Worker(
  'logQueue',
  async (job: Job) => {
    console.log(`Processing batch logs job...`);

    // test transformation
    const transformedLogs: TransformedLog0[] = job.data.map((log: any) => transformLog0(log));

    const sqlInsert = `INSERT INTO logs (time, body, original_log, level)
      VALUES ($1, $2::jsonb, $3, $4);`;

    transformedLogs.forEach((tLog: TransformedLog0) => {
      db.query(sqlInsert, [tLog.time, tLog, tLog.original_log, tLog.level]);
    });

    return transformedLogs;
  },
  {
    connection: redisConnection,
  }
);

logWorker.on('failed', (job: Job | undefined, error: Error, prev: string) => {
  // maybe send failed job to a dead letter queue?
  console.error('Job failed! Error: ', error);
});

// prevent failed job from stopping worker
logWorker.on('error', (error) => {
  console.error('Unhandled exception thrown by logWorker! Error: ', error);
});

// dev only, remove for prod
logWorker.on('completed', (job: Job, returnvalue: any) => {
  console.log('Job completed! Transformed logs: ', returnvalue);
});
