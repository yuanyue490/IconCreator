import type { AiImageAspectRatio, AiImageResolution } from "@iconcraft/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { generateAiImages } from "../services/ai-image-service.js";

const resolutions = ["1K", "2K", "4K"] as [AiImageResolution, ...AiImageResolution[]];
const aspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"] as [
  AiImageAspectRatio,
  ...AiImageAspectRatio[],
];

const aiGenerateRequestSchema = z.object({
  object: z.string().trim().min(1).max(80),
  colorPhrase: z.string().trim().min(1).max(240),
  materialPhrase: z.string().trim().min(1).max(240),
  prompt: z.string().trim().min(1).max(3000),
  negativePrompt: z.string().trim().max(1200),
  resolution: z.enum(resolutions),
  aspectRatio: z.enum(aspectRatios),
  count: z.literal(2),
});

export const aiRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post("/api/ai/generate", async (request, reply) => {
    const parsed = aiGenerateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid AI generate request.",
        issues: parsed.error.flatten(),
      });
    }

    try {
      const result = await generateAiImages(parsed.data);
      return reply.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 生成失败";
      const statusCode = message.includes("API_KEY") ? 503 : 502;
      return reply.code(statusCode).send({ message });
    }
  });
};
