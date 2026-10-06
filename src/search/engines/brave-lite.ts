import { parseHTML } from "linkedom";
import {
	type SearchConfig,
	SearchEngine,
	type SearchResponse,
	type SearchResult,
} from "../types.ts";

const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Brave Search through its public HTML results page.
 * No API key needed; use BraveSearchEngine for the official API.
 */
export class BraveLiteEngine extends SearchEngine {
	readonly name = "brave-lite";

	constructor(config: SearchConfig = {}) {
		super(config);
	}

	async search(query: string): Promise<SearchResponse> {
		const startTime = performance.now();
		const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;

		const response = await fetch(url, {
			headers: {
				"User-Agent": USER_AGENT,
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"Accept-Language": "en-US,en;q=0.9",
			},
			proxy: this.config.proxy,
			signal: this.config.timeout
				? AbortSignal.timeout(this.config.timeout)
				: undefined,
		});

		if (!response.ok) {
			throw new Error(`Brave Lite search failed: ${response.status}`);
		}

		const results = this.parseResults(await response.text());
		if (results.length === 0) {
			throw new Error("Brave Lite returned no results (possible block)");
		}

		return {
			query,
			results,
			engine: this.name,
			duration: performance.now() - startTime,
		};
	}

	private parseResults(html: string): SearchResult[] {
		const { document } = parseHTML(html);
		const results: SearchResult[] = [];

		for (const item of document.querySelectorAll(
			'div.snippet[data-type="web"]',
		)) {
			const url = item.querySelector("a")?.getAttribute("href");
			const title = item.querySelector(".title")?.textContent?.trim();
			if (!url || !title || !/^https?:\/\//.test(url)) continue;

			results.push({
				title,
				url,
				snippet:
					item
						.querySelector(".snippet-description, .content")
						?.textContent?.trim() ?? "",
				rank: results.length + 1,
			});
		}

		return results;
	}
}
