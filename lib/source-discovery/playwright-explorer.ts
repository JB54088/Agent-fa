import type { DiscoveryBudget, DiscoveryCandidate, DiscoveryQuerySeed, DiscoveryRunResult, DiscoverySeed } from "./types.ts";

const discoveryKeywords = /招聘|人才|校园|社会招聘|加入我们|职业|career|careers|join us|成员单位|旗下企业|组织机构|子公司|研究院|研究所|设计院|分公司/i;
const organizationWords = /集团|公司|股份|研究院|研究所|设计院|学院|大学|分公司|中心|银行|科技|装备|能源|基金|医院/i;
const ignoredLinkText = /首页|返回|更多|登录|注册|联系我们|网站地图|隐私|版权|English|Русский|Español/i;

const defaultBudget: DiscoveryBudget = {
  maxNewCandidatesPerDay: 200,
  maxVerificationsPerDay: 100,
  maxBrowserPages: 100,
  timeoutMs: 30_000,
};

async function collectLinks(page: any, timeoutMs: number) {
  await page.waitForLoadState("load", { timeout: timeoutMs }).catch(() => undefined);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await page.locator("a").evaluateAll((elements: Array<Element>) => elements.map((element) => ({
        text: element.textContent ?? "",
        href: (element as HTMLAnchorElement).href ?? element.getAttribute("href") ?? "",
      })));
    } catch (error) {
      if (attempt === 1) throw error;
      await page.waitForTimeout(500);
    }
  }
  return [];
}

function isPrivateHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("172.16.");
}

function isSameOfficialNetwork(seedUrl: string, candidateUrl: string) {
  try {
    const seed = new URL(seedUrl);
    const candidate = new URL(candidateUrl);
    if (!/^https?:$/.test(candidate.protocol) || candidate.username || candidate.password || isPrivateHost(candidate.hostname)) return false;
    const seedHost = seed.hostname.toLowerCase().replace(/^www\./, "");
    const candidateHost = candidate.hostname.toLowerCase().replace(/^www\./, "");
    return candidateHost === seedHost || candidateHost.endsWith(`.${seedHost}`) || seedHost.endsWith(`.${candidateHost}`);
  } catch {
    return false;
  }
}

export function extractDiscoveryCandidates(seed: DiscoverySeed, pageUrl: string, links: Array<{ text: string; href: string }>, maxCandidates: number): DiscoveryCandidate[] {
  const results: DiscoveryCandidate[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    const text = link.text.replace(/\s+/g, " ").trim();
    if (!text || ignoredLinkText.test(text)) continue;
    const isOrganization = organizationWords.test(text) && !/招聘|人才|校园|职业|career|join us/i.test(text);
    if (!discoveryKeywords.test(`${text} ${link.href}`) && !isOrganization) continue;
    let href: string;
    try {
      href = new URL(link.href, pageUrl).toString();
    } catch {
      continue;
    }
    if (!isSameOfficialNetwork(pageUrl, href) && !isOrganization) continue;
    const name = isOrganization ? text.slice(0, 120) : seed.organizationName;
    const key = `${name}|${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      name,
      possibleCategory: seed.category,
      parentOrganizationName: isOrganization ? seed.organizationName : seed.parentOrganizationName ?? null,
      province: seed.province,
      city: null,
      discoveredFrom: isOrganization ? "official_internal_link" : "official_recruitment_link",
      discoveredFromUrl: pageUrl,
      candidateUrl: href,
      candidateType: isOrganization ? "organization" : "source",
      priority: isOrganization ? 40 : 30,
      notes: `Playwright 从官方页面链接文本“${text.slice(0, 80)}”发现。未自动视为正式来源，需继续打开验证。`,
    });
    if (results.length >= maxCandidates) break;
  }
  return results;
}

export async function exploreWithPlaywright(
  seeds: DiscoverySeed[],
  options: { budget?: Partial<DiscoveryBudget>; playwrightModule?: string } = {},
): Promise<DiscoveryRunResult> {
  const budget = { ...defaultBudget, ...options.budget };
  const playwrightModule = options.playwrightModule ?? "playwright";
  const playwright = await import(playwrightModule);
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: false });
  const candidates: DiscoveryCandidate[] = [];
  const failures: DiscoveryRunResult["failures"] = [];

  try {
    for (const seed of seeds.slice(0, budget.maxBrowserPages)) {
      const page = await context.newPage();
      try {
        await page.goto(seed.url, { waitUntil: "domcontentloaded", timeout: budget.timeoutMs });
        const links = await collectLinks(page, budget.timeoutMs);
        candidates.push(...extractDiscoveryCandidates(seed, page.url(), links, Math.max(0, budget.maxNewCandidatesPerDay - candidates.length)));
      } catch (error) {
        failures.push({ seed, error: error instanceof Error ? error.message : String(error) });
      } finally {
        await page.close();
      }
      if (candidates.length >= budget.maxNewCandidatesPerDay) break;
    }
  } finally {
    await context.close();
    await browser.close();
  }
  return { candidates, failures, pagesVisited: Math.min(seeds.length, budget.maxBrowserPages) };
}

export async function searchWithPlaywright(
  queries: DiscoveryQuerySeed[],
  options: { budget?: Partial<DiscoveryBudget>; playwrightModule?: string } = {},
): Promise<DiscoveryRunResult> {
  const budget = { ...defaultBudget, ...options.budget };
  const playwrightModule = options.playwrightModule ?? "playwright";
  const playwright = await import(playwrightModule);
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: false });
  const candidates: DiscoveryCandidate[] = [];
  const failures: DiscoveryRunResult["failures"] = [];
  try {
    for (const query of queries.slice(0, budget.maxBrowserPages)) {
      const page = await context.newPage();
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query.query)}`;
      try {
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: budget.timeoutMs });
        const links = await collectLinks(page, budget.timeoutMs);
        const seen = new Set<string>();
        for (const link of links) {
          const text = link.text.replace(/\s+/g, " ").trim();
          if (!text || !link.href || /bing\.com|microsoft\.com|javascript:/i.test(link.href)) continue;
          let url: URL;
          try { url = new URL(link.href); } catch { continue; }
          if (!/^https?:$/.test(url.protocol) || seen.has(url.origin + url.pathname)) continue;
          seen.add(url.origin + url.pathname);
          candidates.push({
            name: text.slice(0, 120),
            possibleCategory: query.category,
            parentOrganizationName: null,
            province: query.province,
            city: null,
            discoveredFrom: "search_result",
            discoveredFromUrl: searchUrl,
            candidateUrl: url.toString(),
            candidateType: "source",
            priority: query.priority ?? 50,
            notes: `搜索策略“${query.strategy}”发现，仅作为候选；最终来源必须回到官网验证。`,
          });
          if (candidates.length >= budget.maxNewCandidatesPerDay) break;
        }
      } catch (error) {
        failures.push({ seed: { organizationName: query.query, category: query.category, province: query.province, url: searchUrl }, error: error instanceof Error ? error.message : String(error) });
      } finally {
        await page.close();
      }
      if (candidates.length >= budget.maxNewCandidatesPerDay) break;
    }
  } finally {
    await context.close();
    await browser.close();
  }
  return { candidates, failures, pagesVisited: Math.min(queries.length, budget.maxBrowserPages) };
}
