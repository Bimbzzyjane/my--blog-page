import pg from "pg";
import env from "dotenv";

env.config({quiet:true});

const { Pool } = pg;

const db = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL
    })
    : new Pool({
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: Number(process.env.PG_PORT || 5432)
    });

export default db;