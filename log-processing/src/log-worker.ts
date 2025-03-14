import { Worker, Job } from 'bullmq';
import { redisConnection } from './redis-connection';

// Test transformation function
const transformLog = (log: any) => {
  return {
    timestamp: new Date().toISOString(),
    level: log.level || 'info',
    message: log.message || 'test message',
    service: log.service || 'unknown',
  };
};

const logWorker = new Worker(
  'logQueue',
  async (job: Job) => {
    console.log(`Processing log: ${job.data}`);

    // test transformation
    const transformedLog = transformLog(job.data);

    return transformedLog;
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
  console.log('Job completed! Transformed log: ', returnvalue);
});
