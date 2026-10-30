import { readFileSync } from "node:fs";
import { COMMENT_MARKER } from "./report/markdown.js";

export interface PullRequestContext {
  repo: string;
  number: number;
  baseSha?: string;
}

/** Reads the PR number and base sha from the GitHub Actions event payload. */
export function pullRequestFromEnv(env = process.env): PullRequestContext | undefined {
  const repo = env.GITHUB_REPOSITORY;
  const eventPath = env.GITHUB_EVENT_PATH;
  if (!repo || !eventPath) return undefined;
  const event = JSON.parse(readFileSync(eventPath, "utf8")) as {
    pull_request?: { number: number; base?: { sha?: string } };
  };
  if (!event.pull_request) return undefined;
  return { repo, number: event.pull_request.number, baseSha: event.pull_request.base?.sha };
}

/** Creates the DriftCheck comment, or edits the existing one so each PR has exactly one. */
export async function upsertComment(pr: PullRequestContext, body: string, token: string, apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com"): Promise<string> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const base = `${apiUrl}/repos/${pr.repo}/issues`;

  let existing: { id: number; html_url: string } | undefined;
  for (let page = 1; page <= 10 && !existing; page++) {
    const res = await fetch(`${base}/${pr.number}/comments?per_page=100&page=${page}`, { headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status} listing comments`);
    const list = (await res.json()) as { id: number; body?: string; html_url: string }[];
    existing = list.find((c) => c.body?.includes(COMMENT_MARKER));
    if (list.length < 100) break;
  }

  const res = existing
    ? await fetch(`${base}/comments/${existing.id}`, { method: "PATCH", headers, body: JSON.stringify({ body }) })
    : await fetch(`${base}/${pr.number}/comments`, { method: "POST", headers, body: JSON.stringify({ body }) });
  if (!res.ok) throw new Error(`GitHub API ${res.status} writing comment`);
  return ((await res.json()) as { html_url: string }).html_url;
}
