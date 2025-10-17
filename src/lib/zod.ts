// src/lib/zod.ts
// Minimal subset implementation of the Zod API used within this project.
// Supports string/object schemas with min/max/regex validators and safeParse/parse helpers.

type SafeParseSuccess<T> = { success: true; data: T };
type SafeParseFailure = { success: false; error: Error };
type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

interface BaseSchema<T> {
  parse(input: unknown): T;
  safeParse(input: unknown): SafeParseResult<T>;
}

class ZString implements BaseSchema<string> {
  private checks: ((value: string) => string | null)[] = [];

  min(length: number) {
    this.checks.push((value) =>
      value.length >= length ? null : `String must contain at least ${length} character(s)`
    );
    return this;
  }

  max(length: number) {
    this.checks.push((value) =>
      value.length <= length ? null : `String must contain at most ${length} character(s)`
    );
    return this;
  }

  regex(pattern: RegExp) {
    this.checks.push((value) => (pattern.test(value) ? null : 'Invalid format'));
    return this;
  }

  parse(input: unknown): string {
    if (typeof input !== 'string') {
      throw new Error('Expected string');
    }
    for (const check of this.checks) {
      const message = check(input);
      if (message) {
        throw new Error(message);
      }
    }
    return input;
  }

  safeParse(input: unknown): SafeParseResult<string> {
    try {
      return { success: true, data: this.parse(input) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

type Shape = Record<string, BaseSchema<unknown>>;
type InferShape<S extends Shape> = { [K in keyof S]: S[K] extends BaseSchema<infer T> ? T : never };

class ZObject<S extends Shape> implements BaseSchema<InferShape<S>> {
  constructor(private readonly shape: S) {}

  parse(input: unknown): InferShape<S> {
    if (typeof input !== 'object' || input === null) {
      throw new Error('Expected object');
    }
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(this.shape) as (keyof S)[]) {
      const schema = this.shape[key];
      if (!schema) continue;
      output[key as string] = schema.parse((input as Record<string, unknown>)[key as string]);
    }
    return output as InferShape<S>;
  }

  safeParse(input: unknown): SafeParseResult<InferShape<S>> {
    try {
      return { success: true, data: this.parse(input) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}

export const z = {
  string: () => new ZString(),
  object: <S extends Shape>(shape: S) => new ZObject(shape),
};

export type infer<T extends BaseSchema<unknown>> = T extends BaseSchema<infer R> ? R : never;
