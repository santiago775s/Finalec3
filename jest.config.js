/** @type {import('jest').Config} */

// Configuración de transform compartida: se fuerza isolatedModules
// en ts-jest (no en tsconfig.json, que es el scaffolding original
// provisto por la cátedra y no debe modificarse) solo para silenciar
// el warning TS151002 de ts-jest sobre "module": "node16".
const transformTs = {
  '^.+\\.ts$': ['ts-jest', { isolatedModules: true }],
};

module.exports = {
  // server.ts (provisto por la cátedra) llama a app.listen(...) como
  // efecto colateral de importarlo y no expone el handle del server
  // HTTP para cerrarlo; el WorkerPool real tampoco se destruye solo.
  // Se usa forceExit para que Jest no quede colgado esperando que
  // esos recursos de bajo nivel se liberen. Los workers sí se
  // destruyen explícitamente en los afterAll() de cada suite
  // (ver helpers/testApp.ts -> cerrarRecursosDePrueba).
  forceExit: true,
  // testTimeout no es una opción válida dentro de cada entrada de
  // "projects" en esta versión de Jest; se define a nivel global y,
  // donde se necesita más margen (FTP probabilístico), se pasa el
  // tercer argumento directamente a it(...).
  testTimeout: 40000,
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: '.',
      transform: transformTs,
      testMatch: ['<rootDir>/src/frontend/__tests__/unit/**/*.test.ts'],
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: '.',
      transform: transformTs,
      testMatch: ['<rootDir>/src/frontend/__tests__/integration/**/*.test.ts'],
      setupFiles: ['<rootDir>/src/frontend/__tests__/helpers/setupIntegrationEnv.ts'],
    },
    {
      displayName: 'e2e',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: '.',
      transform: transformTs,
      testMatch: ['<rootDir>/src/frontend/__tests__/e2e/**/*.test.ts'],
      setupFiles: ['<rootDir>/src/frontend/__tests__/helpers/setupE2eEnv.ts'],
    },
  ],
};
