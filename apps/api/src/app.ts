import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { AppError } from './lib/errors.js';
import { SESSION_COOKIE, userForToken } from './services/auth.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import customerRoutes from './routes/customer.js';
import merchantRoutes from './routes/merchant.js';
import counterRoutes from './routes/counter.js';
import paymentRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';
import proofRoutes from './routes/proof.js';

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger === false ? false : {
      level: config.LOG_LEVEL,
      redact: ['req.headers.cookie', 'req.body.phone', 'req.body.code', 'res.headers["set-cookie"]'],
      ...(config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
    },
    trustProxy: true,
    bodyLimit: 256 * 1024,
  });

  await app.register(cookie, { secret: config.SESSION_SECRET });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
        frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
        connectSrc: ["'self'", 'https://lumberjack.razorpay.com', 'https://api.razorpay.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        workerSrc: ["'self'", 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
  if (config.NODE_ENV !== 'test') await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute', allowList: (req) => !req.url.startsWith('/api/') });

  app.decorateRequest('user', null);

  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/')) return;
    // CSRF: same-origin only for state-changing requests (docs/09).
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.url.startsWith('/api/webhooks/')) {
      const origin = req.headers.origin;
      if (origin && origin !== config.APP_ORIGIN && !isSameHost(origin, req.headers.host)) {
        throw new AppError(403, 'BAD_ORIGIN', 'Cross-site request blocked');
      }
    }
    const token = req.cookies[SESSION_COOKIE];
    if (token) {
      req.sessionToken = token;
      req.user = await userForToken(token);
    }
  });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err.statusCode === 429) return reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down a little' } });
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: { code: 'BAD_REQUEST', message: err.message } });
    req.log.error(err);
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } });
  });

  await app.register(authRoutes, { prefix: '/api' });
  await app.register(publicRoutes, { prefix: '/api' });
  await app.register(customerRoutes, { prefix: '/api' });
  await app.register(merchantRoutes, { prefix: '/api' });
  await app.register(counterRoutes, { prefix: '/api' });
  await app.register(paymentRoutes, { prefix: '/api' });
  await app.register(adminRoutes, { prefix: '/api' });
  await app.register(proofRoutes, { prefix: '/api' });

  app.all('/api/*', async (_req, reply) => reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Unknown endpoint' } }));

  const webDist = config.WEB_DIST ?? path.resolve(process.cwd(), '../web/dist');
  if (fs.existsSync(path.join(webDist, 'index.html'))) {
    await app.register(fastifyStatic, { root: webDist, wildcard: false, maxAge: '1h' });
    app.get('/*', (req, reply) => {
      const file = path.join(webDist, (req.params as { '*': string })['*']);
      if (file.startsWith(webDist) && fs.existsSync(file) && fs.statSync(file).isFile()) return reply.sendFile(path.relative(webDist, file));
      return reply.header('cache-control', 'no-cache').sendFile('index.html');
    });
  }
  return app;
}

function isSameHost(origin: string, host?: string) {
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}
