import express, { Express, Request, Response } from "express";
import { Queue } from "bullmq";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 8080;

const redisConnection = { host: "127.0.0.1", port: 6379 };
const logQueue = new Queue("logQueue", { connection: redisConnection });

app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

app.post("/logs", async (req: Request, res: Response) => {
  try {
    console.log("Received log:", req.body);
    await logQueue.add("log", req.body);
    console.log("Log Enqueued");
    res.status(200).send("Log Enqueued");
  } catch (error) {
    console.error("Error enqueuing log:", error);
    res.status(500).send("Failed to enqueue log");
  }
});

app.listen(port, () => {
  console.log(`[server]: Log Ingestion App is running at http://localhost:${port}`);
});
