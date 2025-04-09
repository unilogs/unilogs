import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/test/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {}], // Transform TypeScript files, empty config object for ts-jest
  },
  collectCoverage: true,
  collectCoverageFrom: ["lib/**/*.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["json", "lcov", "text", "clover"],
  globals: {},
};

export default config;
