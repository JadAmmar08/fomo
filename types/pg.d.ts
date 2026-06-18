declare module "pg" {
  export class Pool {
    constructor(config?: { connectionString?: string });
    connect(): Promise<PoolClient>;
    query<T = Record<string, unknown>>(
      text: string,
      params?: unknown[]
    ): Promise<{ rows: T[] }>;
  }

  export interface PoolClient {
    query<T = Record<string, unknown>>(
      text: string,
      params?: unknown[]
    ): Promise<{ rows: T[] }>;
    release(): void;
  }
}
