import { Worker } from "bullmq";
import { dispatchReminder } from "@/lib/reminders";
import { getQueueConnection } from "@/lib/queue";

async function startWorker() {
  const connection = getQueueConnection();
  if (!connection) {
    console.error("REDIS_URL não configurada. Worker não iniciado.");
    process.exit(1);
  }

  const worker = new Worker(
    "reminders",
    async (job) => {
      const { reminderLogId } = job.data as { reminderLogId: string };
      await dispatchReminder(reminderLogId);
    },
    { connection }
  );

  worker.on("completed", (job) => {
    console.log(`Lembrete processado: ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Falha ao processar job ${job?.id}:`, error);
  });

  console.log("Worker de lembretes iniciado.");
}

void startWorker();
