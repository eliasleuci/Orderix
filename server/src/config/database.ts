import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from '../common/utils/logger';
import { getTenantId } from '../common/utils/context';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL no está definida. Configurala en server/.env (local) y en las ' +
    'variables de entorno de Vercel (producción).'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const adapter = new PrismaPg(pool);

export const basePrisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const tenantId = getTenantId();

        if (!tenantId || model === 'Tenant') return query(args);

        const typedArgs = args as any;

        if (['findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
          typedArgs.where = { ...typedArgs.where, tenantId };
        }

        if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation)) {
          typedArgs.where = { ...typedArgs.where, tenantId };
        }

        if (operation === 'create' || operation === 'createMany') {
          if (operation === 'create') {
            typedArgs.data = { ...typedArgs.data, tenantId };
          } else {
            const data = Array.isArray(typedArgs.data) ? typedArgs.data : [typedArgs.data];
            typedArgs.data = data.map((item: any) => ({ ...item, tenantId }));
          }
        }

        if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
          const newOp = operation === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
          return (basePrisma as any)[model][newOp]({
            ...typedArgs,
            where: { ...typedArgs.where, tenantId }
          });
        }

        return query(typedArgs);
      },
    },
  },
});

basePrisma.$connect()
  .then(() => logger.info('Database connected (Cloud Pooler mode)'))
  .catch((err) => logger.error('Database connection error:', err));