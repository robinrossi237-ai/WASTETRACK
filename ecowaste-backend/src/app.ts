import express, { type Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

import { env } from './config/env';
import routes from './routes';
import { requestId } from './middlewares/requestId';
import { apiRateLimiter } from './middlewares/rateLimiter';
import { notFound } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';
import { getUploadsDirectory } from './services/uploadsService';

const app = express();

app.disable('x-powered-by');

app.use(requestId);
app.use(helmet());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

const corsOrigin =
  env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

app.use(
  cors({
    origin: corsOrigin.length > 0 ? corsOrigin : true,
  })
);

morgan.token('request-id', (req) => (req as Request).requestId ?? '-');

const logFormat =
  env.NODE_ENV === 'development'
    ? ':method :url :status :res[content-length] - :response-time ms reqid=:request-id'
    : '[:date[iso]] :remote-addr :method :url :status :res[content-length] - :response-time ms reqid=:request-id';

app.use(morgan(logFormat));

app.use(
  '/uploads',
  express.static(path.resolve(getUploadsDirectory()), {
    maxAge: '7d',
    etag: true,
    fallthrough: true,
  })
);

app.use(apiRateLimiter);

app.use(routes);

app.use(notFound);
app.use(errorHandler);

export default app;
