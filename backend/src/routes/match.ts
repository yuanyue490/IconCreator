import type {
  IconLibraryId,
  IconLibraryOption,
  IconLibraryStyleOption,
  IconStyleId,
} from "@iconcraft/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { ICON_LIBRARIES, MATCH_LIMIT, isSupportedLibraryStyle } from "@iconcraft/shared";

import { matchIcons } from "../services/match-service.js";

const libraryIds = ICON_LIBRARIES.map((library: IconLibraryOption) => library.id) as [
  IconLibraryId,
  ...IconLibraryId[],
];
const styleIds = [
  ...new Set(
    ICON_LIBRARIES.flatMap((library: IconLibraryOption) =>
      library.styles.map((style: IconLibraryStyleOption) => style.id),
    ),
  ),
] as [IconStyleId, ...IconStyleId[]];

const matchRequestSchema = z.object({
  words: z.array(z.string().trim().min(1)).min(1).max(MATCH_LIMIT),
  library: z.enum(libraryIds),
  style: z.enum(styleIds),
  llm: z
    .object({
      baseURL: z.string().trim().optional(),
      apiKey: z.string().trim().optional(),
      model: z.string().trim().optional(),
      systemPrompt: z.string().trim().optional(),
    })
    .optional(),
});

export const matchRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post("/api/match", async (request, reply) => {
    const parsed = matchRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid match request.",
        issues: parsed.error.flatten(),
      });
    }

    if (!isSupportedLibraryStyle(parsed.data.library, parsed.data.style)) {
      return reply.code(400).send({
        message: "Unsupported library/style combination.",
      });
    }

    const normalizedWords = parsed.data.words.map((word) => word.trim()).filter(Boolean);
    const result = await matchIcons({
      ...parsed.data,
      words: normalizedWords,
    });

    return reply.send(result);
  });
};
