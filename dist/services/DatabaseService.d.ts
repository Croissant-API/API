import { SupabaseClient, PostgrestQueryBuilder } from '@supabase/supabase-js';
import 'reflect-metadata';
export interface IDatabaseService {
    /**
     * Legacy helper that executes raw SQL using RPC.  New code should favor
     * the supabase query builder obtained via `from(...)` instead of composing
     * SQL strings manually.
     */
    request(query: string, params?: unknown[]): Promise<void>;
    /**
     * Legacy helper that returns rows from a SQL query.  Prefer
     * `db.from<T>(table).select(...)` in new repositories.
     */
    read<T>(query: string, params?: unknown[]): Promise<T[]>;
    /**
     * Execute a raw command/DDL statement that does not return rows.  This is
     * primarily used for `CREATE TABLE` / `ALTER` / other commands which the
     * JSON‑aggregating RPC cannot handle.  Repositories should call this when
     * they need to run statements that don't produce results.
     */
    command(query: string, params?: unknown[]): Promise<void>;
    /**
     * Return true when the configured database is Postgres/D1.  This is useful for
     * repositories that need to build different SQL per engine; the value is driven
     * by the DB_DIALECT environment variable (defaults to sqlite) and also falls
     * back to checking whether a Supabase client exists.
     */
    isPostgres(): boolean;
    initialize(env: any): Promise<void>;
    getClient(): SupabaseClient<any, any, 'croissant', any, any>;
    /**
     * Return a Supabase query builder tied to the given table.  This helper
     * lets repositories stop concatenating SQL strings and instead use the
     * typed `from().select()/.insert()` etc. API that supabase-js exposes.
     *
     * Example:
     *   await db.from<User>('users').select('*').eq('user_id', id);
     */
    from<T>(table: string): PostgrestQueryBuilder<T>;
}
export declare class DatabaseService implements IDatabaseService {
    private supabase;
    private isInitialized;
    private initializationPromise;
    private schema;
    constructor();
    /**
     * Simple helper that can be used by repositories to adjust SQL syntax for
     * the underlying engine.  The value is taken from the DB_DIALECT env var
     * (defaults to sqlite).  When running against Supabase/D1 the caller should
     * set DB_DIALECT=postgres in the Worker env or locally.
     *
     * A related configuration flag, DB_SCHEMA, may be provided when you want the
     * worker to operate against a custom Postgres schema (the default is
     * "public").  The schema name is applied via `SET search_path` during
     * initialization; this prevents permission denied errors when the tables are
     * not in the public schema.
     */
    isPostgres(): boolean;
    getClient(): SupabaseClient<any, any, 'croissant', any, any>;
    /**
     * Convenience wrapper around `supabase.from(...)` so the repository layer
     * doesn't need to pull in the client type.  This also enforces that the
     * service has been initialized before use.
     */
    from<T>(table: string): PostgrestQueryBuilder<T>;
    initialize(env: any): Promise<void>;
    private performInitialization;
    private ensureInitialized;
    private interpolateParams;
    private runQuery;
    request(query: string, params?: unknown[]): Promise<void>;
    read<T>(query: string, params?: unknown[]): Promise<T[]>;
    command(query: string, params?: unknown[]): Promise<void>;
    destroy(): Promise<void>;
}
export default DatabaseService;
