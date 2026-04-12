// Bundle entry point — wraps app.js top-level awaits for IIFE format
(async () => {
  await import('./app.js');
})();
