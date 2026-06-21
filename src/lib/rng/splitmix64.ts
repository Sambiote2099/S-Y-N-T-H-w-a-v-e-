const MASK64 = 0xFFFFFFFFFFFFFFFFn; // keeps BigInt arithmetic in the 64-bit range

/**
 * One step of the splitmix64 algorithm.
 * Given a 64-bit state, produces a 64-bit output and advances the state.
 * The same state always produces the same output — this is the reproducibility guarantee.
 */
export function splitmix64Step(state: bigint): { next: bigint; value: bigint } {
  const next = (state + 0x9e3779b97f4a7c15n) & MASK64;

  let z = next;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  z = z ^ (z >> 31n);

  return { next, value: z };
}

/**
 * Creates a stateful PRNG seeded at `seed`.
 * Calling next() advances the internal state and returns a float in [0, 1).
 */
export function createSplitmix64(seed: bigint) {
  let state = seed & MASK64;

  return {
    /** Returns a float in [0, 1). */
    next(): number {
      const { next, value } = splitmix64Step(state);
      state = next;
      // Use the top 53 bits for the float — these are the highest quality bits
      return Number(value >> 11n) / 2 ** 53;
    },

    /** Returns an integer in [0, max). */
    nextInt(max: number): number {
      return Math.floor(this.next() * max);
    },

    /** Returns an integer in [min, max]. */
    nextIntRange(min: number, max: number): number {
      return min + this.nextInt(max - min + 1);
    },

    /** Picks one item from an array uniformly at random. */
    pick<T>(arr: T[]): T {
      return arr[this.nextInt(arr.length)];
    },
  };
}