import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import { buildGreeting } from "./lib/greetings.ts";

class GitHubRequestError extends Error {
  details?: string;

  constructor(message: string, details?: string) {
    super(message);
    this.name = "GitHubRequestError";
    this.details = details;
  }
}

const decoder = new TextDecoder();
const CLI_UNAVAILABLE_MESSAGE = "GitHub CLI not available";
const CLI_UNAVAILABLE_DETAILS =
  "Deno.Command is required to query the GitHub API via the CLI.";

async function fetchGitHub(endpoint: string): Promise<unknown> {
  const Command = globalThis.Deno?.Command;

  if (!Command) {
    throw new GitHubRequestError(
      CLI_UNAVAILABLE_MESSAGE,
      CLI_UNAVAILABLE_DETAILS,
    );
  }

  try {
    const cmd = new Command("gh", {
      args: ["api", endpoint],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await cmd.output();

    if (code !== 0) {
      const details = decoder.decode(stderr).trim() || undefined;
      throw new GitHubRequestError("GitHub API request failed", details);
    }

    const data = decoder.decode(stdout);
    return JSON.parse(data);
  } catch (error) {
    if (error instanceof GitHubRequestError) {
      throw error;
    }

    throw new GitHubRequestError(
      "Failed to execute GitHub CLI",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export const app = new OpenAPIHono();

const GitHubErrorSchema = z.object({
  error: z.string().openapi({
    example: "GitHub API request failed",
  }),
  details: z.string().optional().openapi({
    example: "Not Found",
  }),
}).openapi("GitHubError");

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
const UnknownRecordSchema = z.record(z.string(), z.unknown());
const UnknownRecordListSchema = z.array(UnknownRecordSchema);

type GitHubErrorResponse = z.infer<typeof GitHubErrorSchema>;
type GitHubUser = z.infer<typeof GitHubUserSchema>;
type GitHubRepository = z.infer<typeof GitHubRepositorySchema>;
type GitHubBranch = z.infer<typeof GitHubBranchSchema>;
type GitHubPullRequest = z.infer<typeof GitHubPullRequestSchema>;

const formatGitHubError = (error: unknown): GitHubErrorResponse => {
  if (error instanceof GitHubRequestError) {
    return {
      error: error.message,
      details: error.details,
    };
  }

  return {
    error: "GitHub API request failed",
    details: error instanceof Error ? error.message : undefined,
  };
};

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

const PullRequestParamsSchema = RepoParamsSchema.extend({
  id: z.string().openapi({
    param: {
      name: "id",
      in: "path",
    },
    example: "123",
    description: "Pull request number or ID",
  }),
});

const errorResponse = {
  description: "GitHub CLI error response",
  content: {
    "application/json": {
      schema: GitHubErrorSchema,
    },
  },
} as const;

const userRoute = createRoute({
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

const reposRoute = createRoute({
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

const repoRoute = createRoute({
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

const branchesRoute = createRoute({
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

const pullRequestsRoute = createRoute({
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

const pullRequestRoute = createRoute({
  method: "get",
  path: "/api/github/{owner}/repos/{repo}/prs/{id}",
  tags: ["GitHub"],
  request: {
    params: PullRequestParamsSchema,
  },
  responses: {
    200: {
      description: "Pull request details",
      content: {
        "application/json": {
          schema: GitHubPullRequestSchema,
        },
      },
    },
    500: errorResponse,
  },
});

app.get("/", (c) => {
  const name = c.req.query("name");
  return c.text(buildGreeting(name));
});

app.openapi(
  userRoute,
  (async (c) => {
    const { owner } = c.req.valid("param");

    try {
      const data = GitHubUserSchema.parse(
        await fetchGitHub(`users/${owner}`),
      );
      return c.json<GitHubUser>(data, 200);
    } catch (error) {
      return c.json<GitHubErrorResponse>(formatGitHubError(error), 500);
    }
  }) as RouteHandler<typeof userRoute>,
);

app.openapi(
  reposRoute,
  (async (c) => {
    const { owner } = c.req.valid("param");

    try {
      const reposRaw = UnknownRecordListSchema.parse(
        await fetchGitHub(`users/${owner}/repos`),
      );
      const cleanedRepos = reposRaw.map((repo) => {
        const { owner: _owner, ...repoWithoutOwner } = repo;
        return repoWithoutOwner;
      });

      const repos = GitHubRepositoryListSchema.parse(cleanedRepos);
      return c.json<GitHubRepository[]>(repos, 200);
    } catch (error) {
      return c.json<GitHubErrorResponse>(formatGitHubError(error), 500);
    }
  }) as RouteHandler<typeof reposRoute>,
);

app.openapi(
  repoRoute,
  (async (c) => {
    const { owner, repo } = c.req.valid("param");

    try {
      const repoData = UnknownRecordSchema.parse(
        await fetchGitHub(`repos/${owner}/${repo}`),
      );
      const { owner: _owner, ...repoWithoutOwner } = repoData;
      const repoResponse = GitHubRepositorySchema.parse(repoWithoutOwner);
      return c.json<GitHubRepository>(repoResponse, 200);
    } catch (error) {
      return c.json<GitHubErrorResponse>(formatGitHubError(error), 500);
    }
  }) as RouteHandler<typeof repoRoute>,
);

app.openapi(
  branchesRoute,
  (async (c) => {
    const { owner, repo } = c.req.valid("param");

    try {
      const branches = GitHubBranchListSchema.parse(
        await fetchGitHub(`repos/${owner}/${repo}/branches`),
      );
      return c.json<GitHubBranch[]>(branches, 200);
    } catch (error) {
      return c.json<GitHubErrorResponse>(formatGitHubError(error), 500);
    }
  }) as RouteHandler<typeof branchesRoute>,
);

app.openapi(
  pullRequestsRoute,
  (async (c) => {
    const { owner, repo } = c.req.valid("param");

    try {
      const pullRequests = GitHubPullRequestListSchema.parse(
        await fetchGitHub(`repos/${owner}/${repo}/pulls`),
      );
      return c.json<GitHubPullRequest[]>(pullRequests, 200);
    } catch (error) {
      return c.json<GitHubErrorResponse>(formatGitHubError(error), 500);
    }
  }) as RouteHandler<typeof pullRequestsRoute>,
);

app.openapi(
  pullRequestRoute,
  (async (c) => {
    const { owner, repo, id } = c.req.valid("param");

    try {
      const pullRequest = GitHubPullRequestSchema.parse(
        await fetchGitHub(`repos/${owner}/${repo}/pulls/${id}`),
      );
      return c.json<GitHubPullRequest>(pullRequest, 200);
    } catch (error) {
      return c.json<GitHubErrorResponse>(formatGitHubError(error), 500);
    }
  }) as RouteHandler<typeof pullRequestRoute>,
);

app.doc31("/doc", {
  openapi: "3.1.0",
  info: {
    title: "Data Hub API",
    version: "1.0.0",
    description: "GitHub proxy endpoints backed by the GitHub CLI.",
  },
});

app.get(
  "/docs",
  swaggerUI({
    url: "/doc",
    version: "latest",
  }) as MiddlewareHandler,
);

const rawPort = globalThis.Deno?.env?.get?.("PORT") ?? "8765";
const parsedPort = Number.parseInt(rawPort, 10);
const port = Number.isNaN(parsedPort) ? 8765 : parsedPort;

if (globalThis.Deno?.serve) {
  globalThis.Deno.serve({ port }, app.fetch);
}
