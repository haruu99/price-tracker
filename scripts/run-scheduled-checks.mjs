import { runDueChecks } from "../lib/tracker-service.js";

const batchSize = Math.max(1, Number(process.env.CHECK_BATCH_SIZE || 10));

try {
  const result = await runDueChecks(batchSize);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}
