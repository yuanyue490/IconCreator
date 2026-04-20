import Fastify from "fastify";
import cors from "@fastify/cors";

import { iconRoute } from "./routes/icons.js";
import { matchRoute } from "./routes/match.js";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

app.get("/api/health", async () => ({ ok: true }));

await app.register(matchRoute);
await app.register(iconRoute);

const port = Number(process.env.PORT ?? 8787);

try {
  await app.listen({ host: "0.0.0.0", port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
