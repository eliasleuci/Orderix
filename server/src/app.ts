import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorMiddleware } from './common/middlewares/errorMiddleware';
import { contextMiddleware } from './common/middlewares/contextMiddleware';
import authRoutes from './modules/auth/routes';
import productRoutes from './modules/products/routes';
import orderRoutes from './modules/orders/routes';
import stockRoutes from './modules/stock/routes';
import reportRoutes from './modules/reports/routes';
import healthRoutes from './modules/health/routes';

const app = express();

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(contextMiddleware);
app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/health', healthRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error Handling
app.use(errorMiddleware);

export default app;
