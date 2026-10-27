// Doc bien moi truong tu .env (xem .env.example o thu muc goc)
export default () => ({
  port: parseInt(process.env.BACKEND_PORT ?? '3000', 10),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/supermarket',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-doi-sau',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  },
  ai: {
    url: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
    timeoutMs: parseInt(process.env.AI_SERVICE_TIMEOUT_MS ?? '8000', 10),
    internalKey: process.env.INTERNAL_API_KEY ?? '',
  },
});
