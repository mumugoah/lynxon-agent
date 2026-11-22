/** Runs this fork plugin's tests against the workspace sources through the root tsconfig paths. */
import { fileURLToPath } from 'node:url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'
import { standardDecoratorPlugin, vitestExecArgv } from '../../vitest.shared.ts'

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [tsconfigPaths({ root: repositoryRoot, projects: ['./tsconfig.base.json'] }), standardDecoratorPlugin()],
  test: {
    include: ['tests/**/*.spec.ts'],
    execArgv: vitestExecArgv,
  },
})
