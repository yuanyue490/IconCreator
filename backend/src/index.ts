import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Fastify from "fastify";
import cors from "@fastify/cors";
import { config as loadEnv } from "dotenv";

import { aiRoute } from "./routes/ai.js";
import { iconRoute } from "./routes/icons.js";
import { matchRoute } from "./routes/match.js";
import { promptSkillRoute } from "./routes/prompt-skills.js";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: resolve(process.cwd(), ".env"), override: false });
loadEnv({ path: resolve(backendRoot, ".env"), override: false });

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

app.get("/api/health", async () => ({
  ok: true as const,
  /** 运维自检：若为旧二进制，可能没有 features 或为旧字段；需含 aiGenerate */
  features: {
    match: true,
    iconsSvg: true,
    aiGenerate: true,
    promptSkillTest: true,
    promptSkillImageConfig: true,
    promptSkillImageGenerate: true,
  },
}));

await app.register(aiRoute);
await app.register(matchRoute);
await app.register(iconRoute);
await app.register(promptSkillRoute);

const port = Number(process.env.PORT ?? 8787);

try {
  await app.listen({ host: "0.0.0.0", port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
