import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  generatePromptSkillImages,
  getPromptSkillImageConfig,
  PromptSkillImageError,
} from "../services/gpt-image-service.js";
import { runPromptSkillTurn, testPromptSkill } from "../services/prompt-skill-service.js";

const promptSkillTestSchema = z.object({
  skillMarkdown: z.string().trim().min(120).max(20000),
  userInput: z.string().trim().min(1).max(4000),
  llm: z
    .object({
      baseURL: z.string().trim().optional(),
      apiKey: z.string().trim().optional(),
      model: z.string().trim().optional(),
      systemPrompt: z.string().trim().optional(),
    })
    .optional(),
});

const promptSkillTurnSchema = z.object({
  skillMarkdown: z.string().trim().min(120).max(20000),
  userMessage: z.string().trim().min(1).max(4000),
  session: z.object({
    status: z.enum(["collecting", "confirming", "ready", "generated"]),
    slots: z
      .object({
        sceneType: z.string().trim().optional(),
        location: z.string().trim().optional(),
        scope: z.string().trim().optional(),
        visualStyles: z.array(z.string().trim()).optional(),
        colorScheme: z.string().trim().optional(),
        specialRequirements: z.string().trim().optional(),
        targetTool: z.string().trim().optional(),
      })
      .default({}),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(4000),
        }),
      )
      .max(20)
      .default([]),
  }),
  llm: z
    .object({
      baseURL: z.string().trim().optional(),
      apiKey: z.string().trim().optional(),
      model: z.string().trim().optional(),
      systemPrompt: z.string().trim().optional(),
    })
    .optional(),
});

const promptSkillImageGenerateSchema = z.object({
  prompt: z.string().trim().min(1).max(8000),
  model: z.string().trim().min(1).max(100).optional(),
  responseFormat: z.enum(["url", "b64_json"]).default("url"),
});

export const promptSkillRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post("/api/prompt-skills/test", async (request, reply) => {
    const parsed = promptSkillTestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "提交内容格式不完整，请检查后重试。",
        issues: parsed.error.flatten(),
      });
    }

    const result = await testPromptSkill(parsed.data);
    return reply.code(result.ok ? 200 : 502).send(result);
  });

  fastify.post("/api/prompt-skills/turn", async (request, reply) => {
    const parsed = promptSkillTurnSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "提交内容格式不完整，请检查后重试。",
        issues: parsed.error.flatten(),
      });
    }

    const result = await runPromptSkillTurn(parsed.data);
    return reply.code(result.ok ? 200 : 502).send(result);
  });

  fastify.get("/api/prompt-skills/image-config", async () => getPromptSkillImageConfig());

  fastify.post("/api/prompt-skills/generate-image", async (request, reply) => {
    const parsed = promptSkillImageGenerateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "提示词内容不完整，请检查后重试。",
        issues: parsed.error.flatten(),
      });
    }

    try {
      const result = await generatePromptSkillImages(parsed.data);
      return reply.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "图片生成失败";
      const statusCode = error instanceof PromptSkillImageError ? error.statusCode : 502;
      const code = error instanceof PromptSkillImageError ? error.code : "IMAGE_GENERATE_FAILED";
      return reply.code(statusCode).send({ message, code });
    }
  });
};
