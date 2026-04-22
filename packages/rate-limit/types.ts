import type { Context, Env, Input, Next } from 'hono';

import type { HeadersName } from './headers';

export type RateLimitInfo = {
  limit: number;
  count: [number, number]; // [hit count, remaining]
  timestamp: number;
};

export type Client = {
  count: number;
  timestamp: number;
};

export type Store = {
  /**
   * Method that initializes the store.
   *
   * @param windowsMs {number} - The duration of time before which all hit counts are reset (in milliseconds).
   */
  init(windowsMs: number): void;

  /**
   * Method to get a client's hit count and reset time.
   *
   * @param key {string} - The client identifier.
   *
   * @returns {Client | undefined} - The number of hits and reset time for that client.
   */
  get(key: string): Client | undefined;

  /**
   * Method to increment a client's hit counter.
   *
   * @param key {string} - The client identifier.
   *
   * @returns {Client} - The number of hits and reset time for that client.
   */
  increment(key: string): Client;

  /**
   * Method to decrement a client's hit counter.
   *
   * @param key {string} - The client identifier.
   */
  decrement(key: string): void;

  /**
   * Method to delete a client.
   *
   * @param key {string} - The client identifier.
   */
  deleteOne(key: string): void;

  /**
   * Method to delete all clients.
   */
  clear(): void;

  /**
   * Method to shutdown the store, stop timers, and release all resources.
   */
  shutdown(): void;
};

type KeyGeneratorType<E extends Env = Env, P extends string = string, I extends Input = Input> = {
  /**
   * Method to generate client identifier.
   */
  keyGenerator: (c: Context<E, P, I>) => string | Promise<string>;
};

export type ConfigType<E extends Env = Env, P extends string = string, I extends Input = Input> = {
  /**
   * The `Store` used to save the hit count for each client.
   *
   * By default, the built-in `MemoryStore` will be used.
   */
  store: Store;

  /**
   * The duration of time before which all hit counts are reset (in milliseconds).
   *
   * Defaults to `60_000` ms (1 minute).
   */
  windowMs: number;

  /**
   * The maximum number of connections.
   *
   * Defaults to `5`.
   */
  limit: number | ((c: Context<E, P, I>) => number | Promise<number>);

  /**
   * If `true`, skip all requests that have a 4XX or 5XX status.
   *
   * Defaults to `false`.
   */
  skipFailedRequests: boolean;

  /**
   * If `true`, skip all requests that have a status code less than 400.
   *
   * Defaults to `false`.
   */
  skipSuccessfulRequests: boolean;

  /**
   * Method for determining whether the request
   * should be ignored.
   *
   * By default, no requests are ignored.
   */
  skip: (c: Context<E, P, I>) => boolean | Promise<boolean>;

  /**
   * Method used for sending back a response when a client is
   * rate-limited.
   *
   * By default, sends back a simple text.
   */
  onRateLimited: (c: Context<E, P, I>, next: Next, headers: Record<HeadersName, string>) => void;
};

export type Config<E extends Env = Env, P extends string = string, I extends Input = Input> = KeyGeneratorType<
  E,
  P,
  I
> &
  Partial<ConfigType<E, P, I>>;
