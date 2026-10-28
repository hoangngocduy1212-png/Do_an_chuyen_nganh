import Joi from 'joi';

const durationPattern = /^\d+[smhd]$/;

export const environmentValidationSchema = Joi.object({
  BACKEND_PORT: Joi.number().port().default(3000),
  MONGODB_URI: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES: Joi.string().pattern(durationPattern).default('15m'),
  JWT_REFRESH_EXPIRES: Joi.string().pattern(durationPattern).default('7d'),
  BCRYPT_COST: Joi.number().integer().min(10).max(15).default(12),
  FRONTEND_URL: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
  MAIL_DRIVER: Joi.string().valid('console', 'smtp').default('console'),
  SMTP_HOST: Joi.when('MAIL_DRIVER', { is: 'smtp', then: Joi.string().required(), otherwise: Joi.string().allow('').default('') }),
  SMTP_PORT: Joi.when('MAIL_DRIVER', { is: 'smtp', then: Joi.number().port().required(), otherwise: Joi.number().port().default(587) }),
  SMTP_USER: Joi.when('MAIL_DRIVER', { is: 'smtp', then: Joi.string().required(), otherwise: Joi.string().allow('').default('') }),
  SMTP_PASS: Joi.when('MAIL_DRIVER', { is: 'smtp', then: Joi.string().required(), otherwise: Joi.string().allow('').default('') }),
  MAIL_FROM: Joi.string().default('Muadee <no-reply@muadee.vn>'),
  AI_SERVICE_URL: Joi.string().uri().default('http://localhost:8000'),
  AI_SERVICE_TIMEOUT_MS: Joi.number().integer().positive().default(8000),
  INTERNAL_API_KEY: Joi.string().allow('').default(''),
  FREE_SHIP_THRESHOLD: Joi.number().integer().min(0).default(200000),
  DEFAULT_SHIPPING_FEE: Joi.number().integer().min(0).default(20000),
  PAYMENT_WEBHOOK_SECRET: Joi.string().min(32).allow('').default(''),
  PAYMENT_BANK_ID: Joi.string().allow('').default(''),
  PAYMENT_BANK_NAME: Joi.string().allow('').default(''),
  PAYMENT_ACCOUNT_NUMBER: Joi.string().allow('').default(''),
  PAYMENT_ACCOUNT_NAME: Joi.string().allow('').default(''),
  PAYMENT_CARD_CHECKOUT_URL: Joi.string().uri({ scheme: ['http', 'https'] }).allow('').default(''),
});

function durationInSeconds(duration: string): number {
  const [, amountText, unit] = duration.match(/^(\d+)([smhd])$/) ?? [];
  const amount = Number(amountText);
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * multipliers[unit];
}

export default () => ({
  port: Number(process.env.BACKEND_PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongoUri: process.env.MONGODB_URI ?? process.env.MONGO_URI,
  frontendUrl: process.env.FRONTEND_URL,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: durationInSeconds(process.env.JWT_ACCESS_EXPIRES ?? '15m'),
    refreshExpires: durationInSeconds(process.env.JWT_REFRESH_EXPIRES ?? '7d'),
  },
  bcryptCost: Number(process.env.BCRYPT_COST ?? 12),
  mail: {
    driver: process.env.MAIL_DRIVER ?? 'console',
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM ?? 'Muadee <no-reply@muadee.vn>',
  },
  ai: {
    url: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
    timeoutMs: Number(process.env.AI_SERVICE_TIMEOUT_MS ?? 8000),
    internalKey: process.env.INTERNAL_API_KEY ?? '',
  },
  business: {
    freeShipThreshold: Number(process.env.FREE_SHIP_THRESHOLD ?? 200000),
    defaultShippingFee: Number(process.env.DEFAULT_SHIPPING_FEE ?? 20000),
  },
  payment: {
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET ?? '',
    bankId: process.env.PAYMENT_BANK_ID ?? '',
    bankName: process.env.PAYMENT_BANK_NAME ?? '',
    accountNumber: process.env.PAYMENT_ACCOUNT_NUMBER ?? '',
    accountName: process.env.PAYMENT_ACCOUNT_NAME ?? '',
    cardCheckoutUrl: process.env.PAYMENT_CARD_CHECKOUT_URL ?? '',
  },
});
