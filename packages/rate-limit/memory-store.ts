import type { Client, Store } from './types';

export class MemoryStore implements Store {
  /**
   * The duration of time before which all hit counts are reset (in milliseconds).
   */
  #windowMs!: number;

  /**
   * These two maps store usage (requests) and reset time by key (for example, IP
   * addresses or API keys).
   *
   * They are split into two to avoid having to iterate through the entire set to
   * determine which ones need reset. Instead, `Client`s are moved from `previous`
   * to `current` as they hit the endpoint. Once `windowMs` has elapsed, all clients
   * left in `previous`, i.e., those that have not made any recent requests, are
   * known to be expired and can be deleted in bulk.
   */
  previous = new Map<string, Client>();
  current = new Map<string, Client>();

  /**
   * A reference to the active timer.
   */
  timeoutId: NodeJS.Timeout | undefined;

  /**
   * Move current clients to previous, create a new map for current.
   *
   * This function is called every `windowMs`.
   */
  private clearExpired(): void {
    this.previous = this.current;
    this.current = new Map();
  }

  /**
   * Get the client or creates a new one.
   *
   * @param key {string} - The client identifier.
   *
   * @returns {Client}
   */
  private getClient(key: string): Client {
    const curr = this.current.get(key);
    if (curr) return curr;

    const prev = this.previous.get(key);
    const client: Client = prev ?? {
      count: 0,
      timestamp: Date.now() + this.#windowMs,
    };

    if (prev) {
      this.previous.delete(key);
    }

    this.current.set(key, client);

    return client;
  }

  init(windowsMs: number) {
    this.#windowMs = windowsMs;

    // Indicates that init was called more than once.
    // Could happen if a store was shared between multiple instances.
    if (this.timeoutId) clearInterval(this.timeoutId);

    // Reset all clients left in previous every `windowMs`.
    this.timeoutId = setInterval(() => {
      this.clearExpired();
    }, this.#windowMs);

    // Cleaning up the interval will be taken care of by the `shutdown` method.
    if (this.timeoutId.unref) this.timeoutId.unref();
  }

  get(key: string) {
    return this.current.get(key) ?? this.previous.get(key);
  }

  increment(key: string) {
    const now = Date.now();
    const client = this.getClient(key);

    if (client.timestamp <= now) {
      client.count = 0;
      client.timestamp = now + this.#windowMs;
    }

    client.count++;

    return client;
  }

  decrement(key: string) {
    const client = this.getClient(key);

    if (client.count > 0) client.count--;
  }

  deleteOne(key: string) {
    this.previous.delete(key);
    this.current.delete(key);
  }

  clear() {
    this.previous.clear();
    this.current.clear();
  }

  shutdown() {
    clearInterval(this.timeoutId);

    this.clear();
  }
}
