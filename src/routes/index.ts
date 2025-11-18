import type { Context } from "hono";
import {
  handleGetUser,
  handleGetUserRepos,
  handleGetRepo,
  handleGetRepoBranches,
  handleGetRepoPulls,
  handleGetRepoPull,
  getUserRoute,
  getUserReposRoute,
  getRepoRoute,
  getRepoBranchesRoute,
  getRepoPullsRoute,
  getRepoPullRoute,
} from './github.ts';
import { buildGreeting } from '../../lib/greetings.ts';

export function handleRoot(c: Context) {
  const name = c.req.query("name");
  return c.text(buildGreeting(name));
}

export function setupRoutes(app: any) {
  // Root route
  app.get("/", handleRoot);

  // GitHub user routes
  app.openapi(getUserRoute, handleGetUser);
  app.openapi(getUserReposRoute, handleGetUserRepos);
  app.openapi(getRepoRoute, handleGetRepo);
  app.openapi(getRepoBranchesRoute, handleGetRepoBranches);
  app.openapi(getRepoPullsRoute, handleGetRepoPulls);
  app.openapi(getRepoPullRoute, handleGetRepoPull);
}