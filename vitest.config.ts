import { defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/parser-options.test.ts']
  }
})