// Rebuild from the shared media manifest while preserving the current editorial details.
process.argv[2] = 'nova-vex';
await import('./build-game-presentations.mjs');
