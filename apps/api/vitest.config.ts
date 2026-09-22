import { defineConfig, type Plugin } from 'vitest/config';
// typescript is already a devDependency of the API (used for `npm run build`).
import ts from 'typescript';

/**
 * NestJS relies on `design:paramtypes` (constructor parameter type metadata)
 * to resolve what to inject with DI (services, controllers). Vitest's default
 * esbuild transform does NOT emit that metadata, which makes the REAL
 * `Test.createTestingModule` instantiate classes with no dependencies.
 * This plugin transpiles the project's own .ts files with TypeScript's
 * transpiler so decorator metadata is available for the real Nest injector.
 */
function nestMetadataTransform(): Plugin {
  return {
    name: 'nest-metadata-transform',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.ts') || id.startsWith('\0')) {
        return;
      }
      const out = ts.transpileModule(code, {
        fileName: id,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          // Keeps the generated Prisma client source smaller/faster to emit.
          isolatedModules: true,
        },
        reportDiagnostics: false,
      });
      return { code: out.outputText, map: null };
    },
  };
}

export default defineConfig({
  plugins: [nestMetadataTransform()],
  resolve: {
    alias: {
      // Same aliases the application uses internally (if any)
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: '../../coverage/api',
      // The generated Prisma client and the DB adapter bootstrap are not
      // business code: they are excluded from the coverage gate so the >=80%
      // target reflects the code the unit tests exercise, not infra plumbing.
      exclude: [
        'src/generated/**',
        'src/main.ts',
        'src/app.module.ts',
        'src/common/services/prisma.service.ts',
      ],
    },
  },
});