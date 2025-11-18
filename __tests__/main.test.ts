import { app } from "../src/server.ts";

type CommandResponse = {
  code?: number;
  data?: unknown;
  raw?: string;
  stderr?: string;
  throws?: string | { nonError: boolean; message: string };
};

const encoder = new TextEncoder();

const installDenoCommandStub = (responses: Record<string, CommandResponse>) => {
  class MockCommand {
    private endpoint: string;

    constructor(_: string, options: { args: string[] }) {
      this.endpoint = options.args[1];
    }

    async output() {
      const response = responses[this.endpoint];

      if (!response) {
        throw new Error(`Missing mock for ${this.endpoint}`);
      }

      if (response.throws) {
        if (typeof response.throws === 'object' && response.throws.nonError) {
          // Throw a non-Error object
          throw response.throws.message;
        }
        throw new Error(response.throws);
      }

      const payload = response.raw ?? (
        response.data !== undefined ? JSON.stringify(response.data) : ""
      );

      return {
        code: response.code ?? 0,
        stdout: encoder.encode(payload),
        stderr: encoder.encode(response.stderr ?? ""),
      };
    }
  }

  globalThis.Deno = {
    Command: MockCommand,
  };
};

const buildRepo = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: "alpha",
  full_name: "octocat/alpha",
  private: false,
  html_url: "https://github.com/octocat/alpha",
  description: null,
  fork: false,
  url: "https://api.github.com/repos/octocat/alpha",
  forks_count: 0,
  stargazers_count: 0,
  watchers_count: 0,
  language: "TypeScript",
  open_issues_count: 0,
  default_branch: "main",
  owner: { login: "octocat" },
  ...overrides,
});

afterEach(() => {
  delete globalThis.Deno;
});

describe("main routes", () => {
  it("responds with a friendly greeting on the root route", async () => {
    const response = await app.request("/?name=Agent");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello Agent!");
  });

  it("proxies GitHub user lookups through the CLI", async () => {
    installDenoCommandStub({
      "users/octocat": {
        code: 0,
        data: {
          login: "octocat",
          id: 1,
          html_url: "https://github.com/octocat",
          public_repos: 2,
          followers: 20,
          following: 1,
        },
      },
    });

    const response = await app.request("/api/github/octocat");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        login: "octocat",
        id: 1,
        html_url: "https://github.com/octocat",
      }),
    );
  });

  it("returns validation errors when GitHub responses do not match the schema", async () => {
    installDenoCommandStub({
      "users/octocat": {
        code: 0,
        data: {
          login: "octocat",
        },
      },
    });

    const response = await app.request("/api/github/octocat");
    expect(response.status).toBe(500);

    const payload = await response.json();
    expect(payload.error).toBe("GitHub API request failed");
    expect(payload.details).toContain("public_repos");
  });

  it("surfaces CLI failures with the stderr details", async () => {
    installDenoCommandStub({
      "users/missing": {
        code: 1,
        stderr: "Not Found",
      },
    });

    const response = await app.request("/api/github/missing");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "GitHub API request failed",
      details: "Not Found",
    });
  });

  it("strips owner objects from repository lists", async () => {
    installDenoCommandStub({
      "users/octocat/repos": {
        code: 0,
        data: [buildRepo()],
      },
    });

    const response = await app.request("/api/github/octocat/repos");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      id: 1,
      name: "alpha",
      full_name: "octocat/alpha",
    });
    expect(payload[0].owner).toBeUndefined();
  });

  it("handles repo list CLI failures", async () => {
    installDenoCommandStub({
      "users/octocat/repos": {
        code: 1,
        stderr: "upstream error",
      },
    });

    const response = await app.request("/api/github/octocat/repos");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "GitHub API request failed",
      details: "upstream error",
    });
  });

  it("handles unexpected CLI execution failures", async () => {
    installDenoCommandStub({
      "users/octocat": {
        throws: "spawn error",
      },
    });

    const response = await app.request("/api/github/octocat");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to execute GitHub CLI",
      details: "spawn error",
    });
  });

  it("strips owner objects from single repo responses", async () => {
    installDenoCommandStub({
      "repos/octocat/alpha": {
        code: 0,
        data: buildRepo(),
      },
    });

    const response = await app.request("/api/github/octocat/repos/alpha");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload).toMatchObject({
      id: 1,
      name: "alpha",
      full_name: "octocat/alpha",
    });
    expect(payload.owner).toBeUndefined();
  });

  it("handles repo detail CLI failures", async () => {
    installDenoCommandStub({
      "repos/octocat/alpha": {
        code: 1,
        stderr: "missing",
      },
    });

    const response = await app.request("/api/github/octocat/repos/alpha");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "GitHub API request failed",
      details: "missing",
    });
  });

  it("returns CLI output for branches", async () => {
    installDenoCommandStub({
      "repos/octocat/alpha/branches": {
        code: 0,
        data: [
          {
            name: "main",
            protected: true,
            commit: {
              sha: "123",
              url: "https://api.github.com/repos/octocat/alpha/commits/123",
            },
          },
        ],
      },
    });

    const response = await app.request(
      "/api/github/octocat/repos/alpha/branches",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ name: "main" }),
    ]);
  });

  it("handles branch CLI failures", async () => {
    installDenoCommandStub({
      "repos/octocat/alpha/branches": {
        code: 1,
        stderr: "branch failure",
      },
    });

    const response = await app.request(
      "/api/github/octocat/repos/alpha/branches",
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "GitHub API request failed",
      details: "branch failure",
    });
  });

  it("returns CLI output for pull requests", async () => {
    installDenoCommandStub({
      "repos/octocat/alpha/pulls": {
        code: 0,
        data: [
          {
            id: 10,
            number: 5,
            state: "open",
            title: "Update docs",
            html_url: "https://github.com/octocat/alpha/pull/5",
            user: {
              login: "hubot",
              id: 2,
            },
          },
        ],
      },
    });

    const response = await app.request("/api/github/octocat/repos/alpha/prs");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ state: "open", title: "Update docs" }),
    ]);
  });

  it("returns CLI output for a single pull request", async () => {
    installDenoCommandStub({
      "repos/octocat/alpha/pulls/5": {
        code: 0,
        data: {
          id: 99,
          number: 5,
          state: "open",
          title: "Update docs",
          html_url: "https://github.com/octocat/alpha/pull/5",
          user: {
            login: "hubot",
            id: 2,
          },
        },
      },
    });

    const response = await app.request("/api/github/octocat/repos/alpha/prs/5");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ number: 5, state: "open" }),
    );
  });

  it("handles pull request CLI failures", async () => {
    installDenoCommandStub({
      "repos/octocat/alpha/pulls": {
        code: 1,
        stderr: "pulls error",
      },
    });

    const response = await app.request("/api/github/octocat/repos/alpha/prs");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "GitHub API request failed",
      details: "pulls error",
    });
  });

  it("handles single pull request CLI failures", async () => {
    installDenoCommandStub({
      "repos/octocat/alpha/pulls/5": {
        code: 1,
        stderr: "pr error",
      },
    });

    const response = await app.request("/api/github/octocat/repos/alpha/prs/5");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "GitHub API request failed",
      details: "pr error",
    });
  });

  it("reports when the GitHub CLI is unavailable", async () => {
    delete globalThis.Deno;

    const response = await app.request("/api/github/octokit");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "GitHub CLI not available",
      details: "Deno.Command is required to query the GitHub API via the CLI.",
    });
  });

  it("serves the OpenAPI documentation endpoint", async () => {
    const response = await app.request("/doc");
    expect(response.status).toBe(200);
    const doc = await response.json();
    expect(doc).toHaveProperty("openapi");
    expect(doc).toHaveProperty("info");
    expect(doc.info.title).toBe("Data Hub API");
  });

  it("serves the Swagger UI docs page", async () => {
    const response = await app.request("/docs");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("swagger-ui");
  });

  it("handles CLI failures with empty stderr", async () => {
    installDenoCommandStub({
      "users/testuser": {
        code: 1,
        stderr: "",
      },
    });

    const response = await app.request("/api/github/testuser");
    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.error).toBe("GitHub API request failed");
    // When stderr is empty, details should be undefined
    expect(payload.details).toBeUndefined();
  });

  it("handles non-Error thrown objects from CLI", async () => {
    installDenoCommandStub({
      "users/testuser": {
        throws: { nonError: true, message: "String error message" },
      },
    });

    const response = await app.request("/api/github/testuser");
    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.error).toBe("Failed to execute GitHub CLI");
    expect(payload.details).toBe("String error message");
  });
});
