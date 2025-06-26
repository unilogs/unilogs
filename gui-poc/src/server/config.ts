const DEFAULT_PORT = 3000;
const DEFAULT_NODE_ENV = 'development';

const nodeEnv = (process.env.NODE_ENV ?? DEFAULT_NODE_ENV) as 'development' | 'production';

const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_PORT,
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isDevelopment: nodeEnv === 'development',
} as const;

export default config;
