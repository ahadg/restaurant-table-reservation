import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import 'dotenv/config';
import * as schema from './schema/index.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
    private pool: Pool;
    public db: NodePgDatabase<typeof schema>;

    constructor() {
        const connectionString =
            process.env.DATABASE_URL ||
            'postgresql://restaurant:restaurant_password@localhost:5432/restaurant_db';

        this.pool = new Pool({ connectionString });
        this.db = drizzle(this.pool, { schema });

        console.log(`[DatabaseService] Connected to PostgreSQL at ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
    }

    async onModuleDestroy() {
        await this.pool.end();
    }

    get schema() {
        return schema;
    }
}