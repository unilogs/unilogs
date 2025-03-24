// This is used for getting user input.
import { createInterface } from 'node:readline/promises';
import { config as dotenvConfig } from 'dotenv';
import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
  paginateListObjectsV2,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

dotenvConfig();
export async function main() {
  // A region and credentials can be declared explicitly. For example
  // `new S3Client({ region: 'us-east-1', credentials: {...} })` would
  //initialize the client with those settings. However, the SDK will
  // use your local configuration and credentials if those properties
  // are not defined here.

  try {
    if (
      process.env.REGION === undefined ||
      process.env.AWS_ACCESS_KEY_ID === undefined ||
      process.env.AWS_SECRET_ACCESS_KEY === undefined ||
      process.env.AWS_SESSION_TOKEN === undefined
    )
      throw new Error();
    const s3Client = new S3Client({
      region: process.env.REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      },
    });

    // Create an Amazon S3 bucket. The epoch timestamp is appended
    // to the name to make it unique.
    const bucketName = `test-bucket-${Date.now()}`;
    const responseFromCreateBucketCommand = await s3Client.send(
      new CreateBucketCommand({
        Bucket: bucketName,
      })
    );

    console.log(responseFromCreateBucketCommand);

    // Put an object into an Amazon S3 bucket.
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: 'my-first-object.txt',
        Body: 'Hello JavaScript SDK!',
      })
    );

    // Read the object.
    const { Body } = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: 'my-first-object.txt',
      })
    );

    if (Body === undefined) throw new Error('Body undefined.');

    console.log(await Body.transformToString());

    // Confirm resource deletion.
    const prompt = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const result = await prompt.question('Empty and delete bucket? (y/n) ');
    prompt.close();

    if (result === 'y') {
      // Create an async iterator over lists of objects in a bucket.
      const paginator = paginateListObjectsV2(
        { client: s3Client },
        { Bucket: bucketName }
      );
      for await (const page of paginator) {
        const objects = page.Contents;
        if (objects) {
          // For every object in each page, delete it.
          for (const object of objects) {
            await s3Client.send(
              new DeleteObjectCommand({ Bucket: bucketName, Key: object.Key })
            );
          }
        }
      }

      // Once all the objects are gone, the bucket can be deleted.
      await s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
    }
  } catch (err) {
    if (!(err instanceof Error)) throw err;
    switch (err.name) {
      case 'ExpiredToken':
      case 'InvalidAccessKeyId':
      case 'SignatureDoesNotMatch':
      case 'InvalidToken':
        console.error(
          'There is a problem with your AWS credentials:\n',
          err.name,
          err.message
        );
        break;

      default:
        throw err;
    }
  }
}

main();
