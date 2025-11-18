#!/usr/bin/env deno run --allow-net --allow-run

const PORT = 8765;

async function killProcessOnPort(port: number): Promise<void> {
  try {
    // Find process using the port
    const findProcessCmd = new Deno.Command("lsof", {
      args: ["-ti", `:${port}`],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr: _stderr } = await findProcessCmd.output();

    if (code === 0 && stdout.length > 0) {
      const pid = new TextDecoder().decode(stdout).trim();
      console.log(`Killing process ${pid} on port ${port}...`);
      
      // Kill the process
      const killCmd = new Deno.Command("kill", {
        args: ["-9", pid],
        stdout: "piped",
        stderr: "piped",
      });

      const killResult = await killCmd.output();
      
      if (killResult.code === 0) {
        console.log(`Successfully killed process ${pid} on port ${port}`);
      } else {
        console.error(`Failed to kill process ${pid} on port ${port}`);
      }
    }
  } catch (error) {
    console.error(`Error checking/killing process on port ${port}:`, error);
  }
}

async function startApp(): Promise<void> {
  console.log(`Starting app on port ${PORT}...`);
  
  // Start the main app by spawning it as a subprocess
  const startCmd = new Deno.Command("deno", {
    args: ["run", "--allow-net", "--allow-env", "src/server.ts"],
    stdout: "inherit",
    stderr: "inherit",
    env: {
      "PORT": PORT.toString(),
    },
  });

  const child = startCmd.spawn();
  
  console.log(`App is running on http://localhost:${PORT}`);
  console.log(`API docs available at http://localhost:${PORT}/docs`);
  
  // Wait for the process to complete
  await child.status;
}

async function main(): Promise<void> {
  await killProcessOnPort(PORT);
  
  // Give a brief moment for the port to be released
  await new Promise(resolve => setTimeout(resolve, 100));
  
  await startApp();
}

if (import.meta.main) {
  main().catch(console.error);
}
