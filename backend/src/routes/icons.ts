import type { FastifyPluginAsync } from "fastify";

import { getLibraryStyleConfig, isSupportedLibraryStyle } from "@iconcraft/shared";
import type { IconLibraryId, IconStyleId } from "@iconcraft/shared";

import { hasIconName } from "../services/icon-catalog.js";

const svgCache = new Map<string, string>();

export const iconRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/icons/:library/:style/:name.svg", async (request, reply) => {
    const params = request.params as { library?: string; style?: string; name?: string };
    const library = params.library;
    const style = params.style;
    const name = params.name;

    if (!library || !style || !name) {
      return reply.code(400).send({ message: "Invalid icon request." });
    }

    const libraryId = library as IconLibraryId;
    const styleId = style as IconStyleId;

    if (!isSupportedLibraryStyle(libraryId, styleId)) {
      return reply.code(400).send({ message: "Unsupported icon library/style." });
    }

    if (!hasIconName(libraryId, styleId, name)) {
      return reply.code(404).send({ message: "Icon not found in local catalog." });
    }

    const styleConfig = getLibraryStyleConfig(libraryId, styleId);
    if (!styleConfig) {
      return reply.code(400).send({ message: "Unsupported icon library/style." });
    }

    const cacheKey = `${library}:${style}:${name}`;
    const cachedSvg = svgCache.get(cacheKey);
    if (cachedSvg) {
      reply.header("Content-Type", "image/svg+xml; charset=utf-8");
      return reply.send(cachedSvg);
    }

    const upstream = await fetch(`https://api.iconify.design/${styleConfig.collection}/${name}.svg`);
    if (!upstream.ok) {
      return reply.code(502).send({ message: "Failed to fetch upstream SVG." });
    }

    const svg = await upstream.text();
    svgCache.set(cacheKey, svg);
    reply.header("Content-Type", "image/svg+xml; charset=utf-8");
    return reply.send(svg);
  });
};
