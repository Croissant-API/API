/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, PostgrestQueryBuilder, SupabaseClient } from '@supabase/supabase-js';
import { injectable } from 'inversify';
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
  // expose the raw supabase client if needed
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

@injectable()
export class DatabaseService implements IDatabaseService {
  private supabase: SupabaseClient<any, any, 'croissant', any, any> | null = null;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  // when DB_SCHEMA is provided we store it here for later use in RPC calls
  private schema: string | null = null;

  constructor() {}

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
  public isPostgres(): boolean {
    const dialect = (process.env.DB_DIALECT || '').toLowerCase();
    if (dialect) {
      return dialect === 'postgres' || dialect === 'pg';
    }
    // fallback: if a supabase client is initialized we assume postgres
    return !!this.supabase;
  }

  public getClient(): SupabaseClient<any, any, 'croissant', any, any> {
    if (!this.supabase) {
      throw new Error('DatabaseService not initialized');
    }
    return this.supabase;
  }

  /**
   * Convenience wrapper around `supabase.from(...)` so the repository layer
   * doesn't need to pull in the client type.  This also enforces that the
   * service has been initialized before use.
   */
  public from<T>(table: string): PostgrestQueryBuilder<T> {
    const client = this.getClient();
    return client.from<T>(table);
  }

  public async initialize(env: any): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;
    this.initializationPromise = this.performInitialization(env);
    return this.initializationPromise;
  }

  private async performInitialization(env: any): Promise<void> {
    try {
      const url = env.SUPABASE_URL || process.env.SUPABASE_URL;
      // prefer service-role key if provided; it has full permissions
      const key = env.SUPABASE_SERVICE_ROLE || env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_KEY;
      if (!url || !key) {
        throw new Error('SUPABASE_URL and SUPABASE key (anon or service role) must be provided');
      }
      const usingService = !!(env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE) && key !== env.SUPABASE_KEY && key !== process.env.SUPABASE_KEY;
      if (usingService) {
        console.log('using service-role key for database connections');
      } else {
        console.log('using anon/public key for database connections');
      }
      // warn if using anon key despite having service role available
      if (process.env.SUPABASE_SERVICE_ROLE && !usingService && key === process.env.SUPABASE_KEY) {
        console.warn('Using anon key even though SUPABASE_SERVICE_ROLE is set in environment');
      }
      console.log('initializing supabase with key length', key.length);
      this.supabase = createClient(url, key, {
        db: { schema: 'croissant' },
      });
      this.isInitialized = true;

      // if a custom schema is specified we'll remember it here and set the
      // search_path for the current connection.  Because each RPC call may use
      // its own backend session, the RPC helper functions themselves should
      // also set the schema internally (see header comments).
      let schema = (env.DB_SCHEMA || process.env.DB_SCHEMA || '').trim();
      if (!schema) {
        // no schema provided – default to `croissant` since the REST API is
        // frequently locked down to that schema.  callers can still override
        // by setting DB_SCHEMA explicitly.
        schema = 'croissant';
        console.warn('DB_SCHEMA not set, defaulting to croissant');
      }

      this.schema = schema;
      console.log(`setting search_path to schema '${schema}'`);
      // call the command RPC; the helper functions should live in the
      // configured schema (never in `public` once a custom schema is used).
      // DatabaseService prefixes names before executing so PostgREST doesn't
      // reject them when only the custom schema is exposed.
      try {
        await this.supabase.rpc(`${schema}.execute_sql_command`, {
          params: JSON.stringify([]),
          query: `SET search_path TO ${schema}`,
        });
      } catch (err) {
        console.warn('failed to set search_path:', err);
      }

      console.log('Supabase client established');
    } catch (err) {
      console.error('Supabase initialization error:', err);
      this.initializationPromise = null;
      throw err;
    }
  }

  private async ensureInitialized(env: any): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize(env);
    }
  }

  private interpolateParams(query: string, params: unknown[] = []): [string, unknown[]] {
    // Supabase-js doesn't support raw SQL directly; this method assumes that
    // a Postgres RPC function named `execute_sql` has been created on the
    // database side. That function should accept (query text, params json)
    // and return rows as json.
    //
    // The RPC uses "EXECUTE ... USING params" which expects $1/$2 placeholders
    // instead of SQLite-style question marks.  We convert any `?` tokens to
    // numbered parameters here so the SQL is valid on Postgres.
    if (params.length === 0) {
      return [query, params];
    }
    let index = 0;
    const transformed = query.replace(/\?/g, () => `$${++index}`);
    return [transformed, params];
  }

  private async runQuery(sql: string, params: unknown[] = [], format: "json" | "csv" = "json"): Promise<{ results: unknown[] } | string> {
    if (!this.supabase) throw new Error('Supabase client not initialized');

    // by default we use a helper Postgres function named `execute_sql` which
    // wraps the supplied query in a `SELECT json_agg(...)` call so that the
    // result can be returned as JSON.  That helper is convenient for
    // `SELECT` statements, but it **cannot** execute DDL/command queries such
    // as `CREATE TABLE`, `ALTER`, etc – doing so will trigger a syntax error
    // (the wrapper attempts to treat the command as a subquery).
    //
    // To handle those cases we also support a second RPC named
    // `execute_sql_command` which simply executes the SQL directly without any
    // wrapping.  You'll need to define it in your database (example below).
    //
    // Example helpers that should exist on your Supabase/Postgres instance:
    //
    // ```sql
    // create or replace function public.execute_sql(params json, query text)
    //   returns json as $$
    // declare
    //   rows json;
    // begin
    //   execute format('select json_agg(t) from (%s) t', query)
    //     using params into rows;
    //   return coalesce(rows, '[]'::json);
    // end;
    // $$ language plpgsql;
    
    // create or replace function public.execute_sql_command(params json, query text)
    //   returns void as $$
    // begin
    //   execute query using params;
    // end;
    // $$ language plpgsql;
    // ```
    //
    // The `execute_sql_command` variant is meant for any non-query commands
    // (DDL, inserts that don't need a result, etc).  Repositories should call
    // `databaseService.command(...)` when they intend to run such statements.

    // NOTE: we no longer prepend a search_path to each query because the
    // JSON‑aggregation RPC (execute_sql) cannot accept multiple statements and
    // doing so causes a syntax error at "TO".  Instead, the helper functions
    // installed in the database should themselves set the desired schema
    // before executing the supplied query (see comments near the top of this
    // file).  The `schema` property remains available for future use if you
    // need to qualify object names manually.

    // normalize the parameters to a proper array.  callers should supply
    // an array of values but a bug or misuse could send a string or object;
    // we guard against that here to avoid the postgres error
    // "cannot extract elements from a scalar" when the helper tries to
    // iterate over `params`.
    let rpcParamsArray: unknown[];
    if (Array.isArray(params)) {
      rpcParamsArray = params;
    } else if (params === undefined || params === null) {
      rpcParamsArray = [];
    } else {
      rpcParamsArray = [params];
    }

    const rpcParams = { params: rpcParamsArray, query: sql };

    // choose RPC based on whether the statement looks like a command
    const trimmed = sql.trim().toUpperCase();
    const useCommandRpc = /^(CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMENT|\s*INSERT|\s*UPDATE|\s*DELETE)/.test(trimmed);
    let rpcName = useCommandRpc ? 'execute_sql_command' : 'execute_sql';

    // if a custom schema was configured, prefix the function name so that
    // PostgREST will look for it in the proper schema instead of `public`.
    // if (this.schema) {
    //   rpcName = `${this.schema}.${rpcName}`;
    // }

    const { data, error } = await this.supabase.rpc(rpcName, rpcParams);
    if (error) {
      console.error('Supabase query error', error);
      // log the SQL that triggered the failure for easier debugging
      console.error('  failed SQL:', sql);
      throw error;
    }

    let rows: any = data;
    if (!Array.isArray(rows)) {
      rows = [];
    }

    if (format === 'csv') {
      if (!Array.isArray(rows) || rows.length === 0) return '';
      const keys = Object.keys(rows[0]);
      const escape = (v: any) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        if (/["\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const header = keys.join(',');
      const lines = rows.map(r => keys.map(k => escape(r[k])).join(','));
      return [header, ...lines].join('\n');
    }

    // parse strings recursively as before
    const parseRecursively = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'string') {
        try {
          const parsed = JSON.parse(obj);
          return parseRecursively(parsed);
        } catch {
          return obj;
        }
      }
      if (Array.isArray(obj)) {
        return obj.map(item => parseRecursively(item));
      }
      if (typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = parseRecursively(value);
        }
        return result;
      }
      return obj;
    };

    return parseRecursively({ results: rows });
  }

  public async request(query: string, params: unknown[] = []): Promise<void> {
    try {
      const [sql, sqlParams] = this.interpolateParams(query, params);
      await this.runQuery(sql, sqlParams);
    } catch (err) {
      console.error('Error executing query', err);
      throw err;
    }
  }

  public async read<T>(query: string, params: unknown[] = []): Promise<T[]> {
    try {
      const [sql, sqlParams] = this.interpolateParams(query, params);
      const result = await this.runQuery(sql, sqlParams, 'json');
      let rows: unknown[] = [];
      if (typeof result === 'object' && result !== null && 'results' in result) {
        rows = (result as any).results || [];
      }
      if (!Array.isArray(rows)) {
        console.warn('Database query returned non-array result:', rows);
        return [];
      }
      return rows as T[];
    } catch (err) {
      console.error('Error reading data', err);
      throw err;
    }
  }

  public async command(query: string, params: unknown[] = []): Promise<void> {
    try {
      const [sql, sqlParams] = this.interpolateParams(query, params);
      // explicitly mark as a command so runQuery uses the appropriate RPC
      await this.runQuery(sql, sqlParams);
    } catch (err) {
      console.error('Error executing command', err);
      throw err;
    }
  }

  public async destroy(): Promise<void> {
    console.log('DatabaseService destroyed');
  }
}

export default DatabaseService;


