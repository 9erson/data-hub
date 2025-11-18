import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
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
    return c.json(JSON.parse(data));
  } catch (error) {
    return c.json({
      error: "Failed to execute GitHub CLI",
      details: error.message,
    }, 500);
  }
});

Deno.serve(app.fetch);
