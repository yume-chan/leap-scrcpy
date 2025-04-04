export class Lazy<T, Args extends unknown[]> {
  #initializer: (...args: Args) => T;

  #hasValue = false;
  get hasValue() { return this.#hasValue }

  #value: T | undefined;

  constructor(initializer: (...args: Args) => T) {
    this.#initializer = initializer;
  }

  getOrCreate(...args: Args): T {
    if (!this.#hasValue) {
      this.#value = this.#initializer(...args);
      this.#hasValue = true;
    }

    return this.#value as T;
  }

  get() {
    if (!this.#hasValue) {
      throw new Error("Lazy is not initialized");
    }
    return this.#value as T;
  }
}
