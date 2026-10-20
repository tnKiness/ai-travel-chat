import { defineConfig } from 'vitest/config';

// Only pure modules are unit-tested here; UI is exercised through the web build.
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
