const decoder = new TextDecoder();

export class GitHubRequestError extends Error {
  details?: string;

  constructor(message: string, details?: string) {
    super(message);
    this.name = "GitHubRequestError";
    this.details = details;
  }
}

export async function fetchGitHub<T = unknown>(endpoint: string): Promise<T> {
  // Check if Deno.Command is available
  if (typeof Deno === 'undefined' || !Deno.Command) {
    throw new GitHubRequestError(
      "GitHub CLI not available",
      "Deno.Command is required to query the GitHub API via the CLI."
    );
  }

  try {
    const cmd = new Deno.Command("gh", {
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
    return JSON.parse(data) as T;
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