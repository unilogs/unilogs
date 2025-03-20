import dotenv from "dotenv";
import { Kafka } from "kafkajs";

dotenv.config();

// Kafka setup
const kafka = new Kafka({
  clientId: "log-ingestion-app",
  brokers: ["localhost:9092"],  
});

const consumer = kafka.consumer({ 
  groupId: "log-consumer-group" // No autoCommit setting required here
});

// Function to monitor logs from Kafka
async function monitorLogs() {
  await consumer.connect();
  await consumer.subscribe({ topic: "app_logs_topic", fromBeginning: true });

  consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        if (!message.value) {
          return;
        }

        const logData = JSON.parse(message.value.toString());
        console.log("Received log from Kafka:", logData);

        // Here you're just monitoring the logs, no commits happen

      } catch (error) {
        console.error("Error processing Kafka message:", error);
      }
    },
  });
}

// Start Kafka consumer for monitoring only
monitorLogs().catch(console.error);
