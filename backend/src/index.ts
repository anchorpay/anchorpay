import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { billsRouter } from './routes/bills';

const app = express();

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin:
      config.nodeEnv === 'production'
        ? ['https://anchorpay.app', 'https://www.anchorpay.app']
        : ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, slow down.' },
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/bills', billsRouter);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    network: config.stellar.network,
    timestamp: new Date().toISOString(),
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`AnchorPay backend running on port ${config.port} [${config.nodeEnv}]`);
  console.log(`Stellar network: ${config.stellar.network}`);
});

export default app;
