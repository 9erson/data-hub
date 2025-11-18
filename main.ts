import { Hono } from "hono";
import { buildGreeting } from "./lib/greetings.ts";

const app = new Hono();

app.get("/", (c) => {
  const name = c.req.query("name");
  return c.text(buildGreeting(name));
});

app.get("/api/github/:owner", async (c) => {
  const owner = c.req.param("owner");

  try {
    const cmd = new Deno.Command("gh", {
      args: ["api", `users/${owner}`],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await cmd.output();

    if (code !== 0) {
      return c.json({
        error: "GitHub API request failed",
        details: new TextDecoder().decode(stderr),
      }, 500);
    }

    const data = new TextDecoder().decode(stdout);
    return c.json(JSON.parse(data));
  } catch (error) {
    return c.json({
      error: "Failed to execute GitHub CLI",
      details: error.message,
    }, 500);
  }
});

app.get("/api/github/:owner/repos", async (c) => {
  const owner = c.req.param("owner");

  try {
    const cmd = new Deno.Command("gh", {
      args: ["api", `users/${owner}/repos`],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await cmd.output();

    if (code !== 0) {
      return c.json({
        error: "GitHub API request failed",
        details: new TextDecoder().decode(stderr),
      }, 500);
    }

    const data = new TextDecoder().decode(stdout);
    const repos = JSON.parse(data);

    // Remove owner property from each repo
    const cleanedRepos = repos.map((repo: Record<string, unknown>) => {
      const { owner: _owner, ...repoWithoutOwner } = repo;
      return repoWithoutOwner;
    });

    return c.json(cleanedRepos);
  } catch (error) {
    return c.json({
      error: "Failed to execute GitHub CLI",
      details: error.message,
    }, 500);
  }
});

app.get("/api/github/:owner/repos/:repo", async (c) => {
  const owner = c.req.param("owner");
  const repo = c.req.param("repo");

  try {
    const cmd = new Deno.Command("gh", {
      args: ["api", `repos/${owner}/${repo}`],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await cmd.output();

    if (code !== 0) {
      return c.json({
        error: "GitHub API request failed",
        details: new TextDecoder().decode(stderr),
      }, 500);
    }

    const data = new TextDecoder().decode(stdout);
    const repoData = JSON.parse(data);

    // Remove owner property from repo data
    const { owner: _owner, ...repoWithoutOwner } = repoData;

    return c.json(repoWithoutOwner);
  } catch (error) {
    return c.json({
      error: "Failed to execute GitHub CLI",
      details: error.message,
    }, 500);
  }
});

Deno.serve(app.fetch);
