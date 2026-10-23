// Local design preview. Serves the current app with isolated in-memory fixtures.
process.env.QA_STUDIO_PREVIEW='1';
await import('./verify-studio-workspaces.mjs');
