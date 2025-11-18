import type { Context } from "hono";
import { createRoute, z } from "@hono/zod-openapi";
import { fetchGitHub, GitHubRequestError } from '../github/client.ts';

const GitHubUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  name: z.string().nullable().optional(),
  avatar_url: z.string().url().optional(),
  html_url: z.string().url(),
  public_repos: z.number(),
  followers: z.number(),
  following: z.number(),
}).passthrough().openapi("GitHubUser");

const GitHubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  html_url: z.string().url(),
  description: z.string().nullable().optional(),
  fork: z.boolean(),
  url: z.string().url(),
  forks_count: z.number(),
  stargazers_count: z.number(),
  watchers_count: z.number(),
  language: z.string().nullable().optional(),
  open_issues_count: z.number(),
  default_branch: z.string(),
}).passthrough().openapi("GitHubRepository");

const GitHubBranchSchema = z.object({
  name: z.string(),
  protected: z.boolean().optional(),
  commit: z.object({
    sha: z.string(),
    url: z.string().url(),
  }).passthrough(),
}).passthrough().openapi("GitHubBranch");

const GitHubPullRequestSchema = z.object({
  id: z.number(),
  number: z.number(),
  state: z.string(),
  title: z.string(),
  html_url: z.string().url(),
  user: z.object({
    login: z.string(),
    id: z.number(),
  }).passthrough(),
}).passthrough().openapi("GitHubPullRequest");

const GitHubRepositoryListSchema = z.array(GitHubRepositorySchema).openapi(
  "GitHubRepositoryList",
);
const GitHubBranchListSchema = z.array(GitHubBranchSchema).openapi(
  "GitHubBranchList",
);
const GitHubPullRequestListSchema = z.array(GitHubPullRequestSchema).openapi(
  "GitHubPullRequestList",
);

const OwnerParamsSchema = z.object({
  owner: z.string().openapi({
    param: {
      name: "owner",
      in: "path",
    },
    example: "denoland",
    description: "GitHub username or organization",
  }),
});

const RepoParamsSchema = OwnerParamsSchema.extend({
  repo: z.string().openapi({
    param: {
      name: "repo",
      in: "path",
    },
    example: "deno",
    description: "Repository name",
  }),
});

const GitHubErrorSchema = z.object({
  error: z.string().openapi({
    example: "GitHub API request failed",
  }),
  details: z.string().optional().openapi({
    example: "Not Found",
  }),
}).openapi("GitHubError");

const errorResponse = {
  description: "GitHub CLI error response",
  content: {
    "application/json": {
      schema: GitHubErrorSchema,
    },
  },
};

export const getUserRoute = createRoute({
  method: "get",
  path: "/api/github/{owner}",
  tags: ["GitHub"],
  request: {
    params: OwnerParamsSchema,
  },
  responses: {
    200: {
      description: "GitHub profile for the provided owner",
      content: {
        "application/json": {
          schema: GitHubUserSchema,
        },
      },
    },
    500: errorResponse,
  },
});

export const getUserReposRoute = createRoute({
  method: "get",
  path: "/api/github/{owner}/repos",
  tags: ["GitHub"],
  request: {
    params: OwnerParamsSchema,
  },
  responses: {
    200: {
      description: "List repositories for an owner",
      content: {
        "application/json": {
          schema: GitHubRepositoryListSchema,
        },
      },
    },
    500: errorResponse,
  },
});

export const getRepoRoute = createRoute({
  method: "get",
  path: "/api/github/{owner}/repos/{repo}",
  tags: ["GitHub"],
  request: {
    params: RepoParamsSchema,
  },
  responses: {
    200: {
      description: "Details for a specific repository",
      content: {
        "application/json": {
          schema: GitHubRepositorySchema,
        },
      },
    },
    500: errorResponse,
  },
});

export const getRepoBranchesRoute = createRoute({
  method: "get",
  path: "/api/github/{owner}/repos/{repo}/branches",
  tags: ["GitHub"],
  request: {
    params: RepoParamsSchema,
  },
  responses: {
    200: {
      description: "Repository branches",
      content: {
        "application/json": {
          schema: GitHubBranchListSchema,
        },
      },
    },
    500: errorResponse,
  },
});

export const getRepoPullsRoute = createRoute({
  method: "get",
  path: "/api/github/{owner}/repos/{repo}/prs",
  tags: ["GitHub"],
  request: {
    params: RepoParamsSchema,
  },
  responses: {
    200: {
      description: "Open pull requests for a repository",
      content: {
        "application/json": {
          schema: GitHubPullRequestListSchema,
        },
      },
    },
    500: errorResponse,
  },
});

const respondWithGitHubError = (c: Context, error: unknown) => {
  if (error instanceof GitHubRequestError) {
    return c.json({
      error: error.message,
      details: error.details,
    }, 500);
  }

  return c.json({
    error: "GitHub API request failed",
    details: error instanceof Error ? error.message : undefined,
  }, 500);
};

export function handleGetUser(c: Context) {
  const { owner } = c.req.valid("param");

  return fetchGitHub(`users/${owner}`)
    .then(data => c.json(data))
    .catch(error => respondWithGitHubError(c, error));
}

export function handleGetUserRepos(c: Context) {
  const { owner } = c.req.valid("param");

  return fetchGitHub<Record<string, unknown>[]>(`users/${owner}/repos`)
    .then(repos => {
      const cleanedRepos = repos.map((repo) => {
        const { owner: _owner, ...repoWithoutOwner } = repo;
        return repoWithoutOwner;
      });
      return c.json(cleanedRepos);
    })
    .catch(error => respondWithGitHubError(c, error));
}

export function handleGetRepo(c: Context) {
  const { owner, repo } = c.req.valid("param");

  return fetchGitHub<Record<string, unknown>>(`repos/${owner}/${repo}`)
    .then(repoData => {
      const { owner: _owner, ...repoWithoutOwner } = repoData;
      return c.json(repoWithoutOwner);
    })
    .catch(error => respondWithGitHubError(c, error));
}

export function handleGetRepoBranches(c: Context) {
  const { owner, repo } = c.req.valid("param");

  return fetchGitHub(`repos/${owner}/${repo}/branches`)
    .then(data => c.json(data))
    .catch(error => respondWithGitHubError(c, error));
}

export function handleGetRepoPulls(c: Context) {
  const { owner, repo } = c.req.valid("param");

  return fetchGitHub(`repos/${owner}/${repo}/pulls`)
    .then(data => c.json(data))
    .catch(error => respondWithGitHubError(c, error));
}