export {};

interface DenoCommandOutput {
  code: number;
  stdout: Uint8Array;
  stderr: Uint8Array;
}

interface DenoCommand {
  output(): Promise<DenoCommandOutput>;
}

interface DenoCommandOptions {
  args: string[];
  stdout: "piped";
  stderr: "piped";
}

interface DenoCommandConstructor {
  new (cmd: string, options: DenoCommandOptions): DenoCommand;
}

interface DenoEnv {
  get?(name: string): string | undefined;
}

interface DenoLike {
  Command?: DenoCommandConstructor;
  env?: DenoEnv;
  serve?: (
    options: { port: number },
    handler: (req: Request) => Response | Promise<Response>,
  ) => unknown;
}

declare global {
  interface GlobalThis {
    Deno?: DenoLike;
  }
}
