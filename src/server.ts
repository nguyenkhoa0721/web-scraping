#!/usr/bin/env bun

import { createApp } from "./app.ts";
import { createLogger } from "./common/logger.ts";
import { type RuntimeConfig, runtimeConfig } from "./config/runtime.ts";
import { Scraper } from "./scraper/scraper.ts";
import { BraveSearchEngine } from "./search/engines/brave.ts";
import { BraveLiteEngine } from "./search/engines/brave-lite.ts";
import { CoccocEngine } from "./search/engines/coccoc.ts";
import { DuckDuckGoEngine } from "./search/engines/duckduckgo.ts";
import { SearchEngineRegistry } from "./search/registry.ts";

const log = createLogger("server");

async function bootstrap() {
	const { server, scraper: scraperConfig, search } = runtimeConfig;
	if (search.proxy) log.info("search proxy enabled");
	const scraper = new Scraper(scraperConfig);
	await scraper.initialize();

	const searchRegistry = createSearchRegistry(search);
	const app = createApp({ scraper, searchRegistry });
	const httpServer = app.listen(server.port, server.host, () => {
		log.info("server ready", {
			url: `http://${server.host}:${server.port}`,
			concurrency: scraperConfig.concurrency,
			timeout: scraperConfig.timeout,
		});
	});

	const shutdown = async (signal: string) => {
		log.info("shutting down", { signal });
		httpServer.close(async () => {
			await scraper.shutdown();
			process.exit(0);
		});
	};

	process.once("SIGINT", () => void shutdown("SIGINT"));
	process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

function createSearchRegistry(
	search: RuntimeConfig["search"],
): SearchEngineRegistry {
	const registry = new SearchEngineRegistry();
	const { proxy } = search;
	registry.register(new DuckDuckGoEngine());
	registry.register(new CoccocEngine({ proxy }));
	registry.register(new BraveLiteEngine({ proxy }));

	if (search.brave.apiKey) {
		registry.register(
			new BraveSearchEngine({ apiKey: search.brave.apiKey, proxy }),
		);
	} else {
		log.warn("Brave Search API disabled: BRAVE_SEARCH_API_KEY is not set");
	}

	return registry;
}

bootstrap().catch((error) => {
	log.error("server failed to start", {
		error: error instanceof Error ? error.message : String(error),
	});
	process.exit(1);
});
