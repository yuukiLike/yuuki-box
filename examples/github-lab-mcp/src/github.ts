import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import { repositorySchema, shaSchema } from './contracts.js';

export class GitHub {
  private readonly api: Octokit;

  constructor(options: { token?: string | undefined; baseUrl?: string | undefined; fetch?: typeof fetch } = {}) {
    const baseUrl = options.baseUrl ?? 'https://api.github.com';
    const url = new URL(baseUrl);
    const localFixture = url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.pathname === '/';
    if (baseUrl !== 'https://api.github.com' && !localFixture) throw new Error('仅支持 GitHub 公共 API 或 127.0.0.1 测试服务。');
    if (localFixture && options.token) throw new Error('测试服务不能接收 GitHub token。');
    this.api = new Octokit({
      auth: options.token, baseUrl,
      userAgent: 'yuuki-github-lab/1.0.0',
      request: { timeout: 15_000, fetch: options.fetch ?? fetch },
      log: { debug() {}, info() {}, warn() {}, error() {} },
    });
  }

  async searchProjects(query: string, language: string, signal?: AbortSignal) {
    const { data } = await this.api.rest.search.repos({
      q: `${query} language:${language} is:public archived:false`,
      sort: 'updated', order: 'desc', per_page: 30,
      headers: { 'X-GitHub-Api-Version': '2026-03-10' }, request: signal ? { signal } : {},
    });
    return {
      incomplete: data.incomplete_results,
      items: data.items.filter(item => !item.private).map(item => ({
        repository: repositorySchema.parse(item.full_name).toLowerCase(), url: item.html_url,
        description: item.description ?? '', language: item.language ?? null,
        topics: item.topics ?? [], stars: item.stargazers_count, pushedAt: item.pushed_at ?? null,
      })),
    };
  }

  async searchRepairs(repository: string, keywords: string, signal?: AbortSignal) {
    const { data } = await this.api.rest.search.issuesAndPullRequests({
      q: `repo:${repository} is:pr is:merged ${keywords}`, sort: 'updated', per_page: 30,
      request: signal ? { signal } : {},
    });
    return {
      incomplete: data.incomplete_results,
      // 不把正文中的解决方案带进默认的探索结果。
      items: data.items.filter(item => item.pull_request?.merged_at &&
        item.repository_url.toLowerCase() === `https://api.github.com/repos/${repository}`)
        .map(item => ({ repository, number: item.number, title: item.title, url: item.html_url })),
    };
  }

  async experiment(repository: string, pullNumber: number, signal?: AbortSignal) {
    const [owner = '', repo = ''] = repositorySchema.parse(repository).split('/');
    const params = { owner, repo, request: signal ? { signal } : {} };
    const { data: metadata } = await this.api.rest.repos.get(params);
    if (metadata.private || metadata.archived) throw new Error('实验仅接受未归档的公开仓库。');
    if (metadata.size > 50_000) throw new Error('仓库超过 50 MB 元数据大小，请选择更小的首轮实验。');
    const { data: pull } = await this.api.rest.pulls.get({ ...params, pull_number: pullNumber });
    if (!pull.merged || !pull.head.repo || pull.changed_files > 12 || pull.commits > 20) {
      throw new Error('请选择已合并、最多 12 个改动文件及 20 个提交的小型 PR。');
    }
    const referenceSha = shaSchema.parse(pull.head.sha);
    const { data: comparison } = await this.api.rest.repos.compareCommitsWithBasehead({
      ...params, basehead: `${shaSchema.parse(pull.base.sha)}...${referenceSha}`,
    });
    const baselineSha = shaSchema.parse(comparison.merge_base_commit.sha);
    if (baselineSha === referenceSha) throw new Error('修复前后没有可比较的代码版本。');
    // 只取正文里明确关联的本仓库 Issue；正文和补丁留到揭示步骤。
    const issueNumbers = [...(pull.body ?? '').matchAll(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|solves?)\s+(?:the\s+)?#(\d+)/gi)]
      .map(match => Number(match[1])).filter(number => number !== pullNumber).slice(0, 2);
    const issues = [];
    for (const issue_number of new Set(issueNumbers)) {
      const { data: issue } = await this.api.rest.issues.get({ ...params, issue_number });
      issues.push({ number: issue.number, title: issue.title, body: (issue.body ?? '').slice(0, 12_000), url: issue.html_url });
    }
    return { title: pull.title, url: pull.html_url, baselineSha, referenceSha, issues };
  }
}

export function githubError(error: unknown): string {
  if (error instanceof Error && 'status' in error && [403, 429].includes(Number(error.status))) {
    return 'GitHub 拒绝请求或达到限额。稍后再试；公开只读访问可选用 GITHUB_TOKEN 提高额度。';
  }
  if (error instanceof z.ZodError) return `数据校验失败：${error.issues.map(issue => issue.message).join('；')}`;
  return error instanceof Error ? error.message.slice(0, 1800) : '操作失败，未取得可验证结果。';
}
