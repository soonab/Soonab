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
  private shouldTrim = false;

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

  trim() {
    this.shouldTrim = true;
    return this;
  }

  refine(check: (value: string) => boolean, message = 'Invalid value') {
    this.checks.push((value) => (check(value) ? null : message));
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
    const value = this.shouldTrim ? input.trim() : input;
    for (const check of this.checks) {
      const message = check(value);
      if (message) {
        throw new Error(message);
      }
    }
    return value;
  }

  safeParse(input: unknown): SafeParseResult<string> {
    try {
      return { success: true, data: this.parse(input) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  optional() {
    return new ZOptional(this);
  }

  nullable() {
    return new ZNullable(this);
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

  optional() {
    return new ZOptional(this);
  }

  nullable() {
    return new ZNullable(this);
  }
}

class ZNumber implements BaseSchema<number> {
  private checks: ((value: number) => string | null)[] = [];

  min(value: number) {
    this.checks.push((input) => (input >= value ? null : `Number must be >= ${value}`));
    return this;
  }

  max(value: number) {
    this.checks.push((input) => (input <= value ? null : `Number must be <= ${value}`));
    return this;
  }

  int() {
    this.checks.push((input) => (Number.isInteger(input) ? null : 'Number must be an integer'));
    return this;
  }

  positive() {
    this.checks.push((input) => (input > 0 ? null : 'Number must be positive'));
    return this;
  }

  parse(input: unknown): number {
    if (typeof input !== 'number' || Number.isNaN(input)) {
      throw new Error('Expected number');
    }
    for (const check of this.checks) {
      const message = check(input);
      if (message) throw new Error(message);
    }
    return input;
  }

  safeParse(input: unknown): SafeParseResult<number> {
    try {
      return { success: true, data: this.parse(input) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  optional() {
    return new ZOptional(this);
  }

  nullable() {
    return new ZNullable(this);
  }
}

class ZArray<T> implements BaseSchema<T[]> {
  private maxLength: number | null = null;
  private minLength: number | null = null;

  constructor(private readonly inner: BaseSchema<T>) {}

  max(length: number) {
    this.maxLength = length;
    return this;
  }

  min(length: number) {
    this.minLength = length;
    return this;
  }

  parse(input: unknown): T[] {
    if (!Array.isArray(input)) {
      throw new Error('Expected array');
    }
    if (this.minLength !== null && input.length < this.minLength) {
      throw new Error(`Array must contain at least ${this.minLength} element(s)`);
    }
    if (this.maxLength !== null && input.length > this.maxLength) {
      throw new Error(`Array must contain at most ${this.maxLength} element(s)`);
    }
    return input.map((item) => this.inner.parse(item));
  }

  safeParse(input: unknown): SafeParseResult<T[]> {
    try {
      return { success: true, data: this.parse(input) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  optional() {
    return new ZOptional(this);
  }

  nullable() {
    return new ZNullable(this);
  }
}

class ZEnum<T extends string> implements BaseSchema<T> {
  constructor(private readonly values: readonly T[]) {}

  parse(input: unknown): T {
    if (typeof input !== 'string' || !this.values.includes(input as T)) {
      throw new Error('Invalid enum value');
    }
    return input as T;
  }

  safeParse(input: unknown): SafeParseResult<T> {
    try {
      return { success: true, data: this.parse(input) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  optional() {
    return new ZOptional(this);
  }

  nullable() {
    return new ZNullable(this);
  }
}

class ZOptional<T> implements BaseSchema<T | undefined> {
  constructor(private readonly inner: BaseSchema<T>) {}

  parse(input: unknown): T | undefined {
    if (input === undefined) return undefined;
    return this.inner.parse(input);
  }

  safeParse(input: unknown): SafeParseResult<T | undefined> {
    try {
      return { success: true, data: this.parse(input) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  nullable() {
    return new ZNullable(this);
  }
}

class ZNullable<T> implements BaseSchema<T | null> {
  constructor(private readonly inner: BaseSchema<T>) {}

  parse(input: unknown): T | null {
    if (input === null) return null;
    return this.inner.parse(input);
  }

  safeParse(input: unknown): SafeParseResult<T | null> {
    try {
      return { success: true, data: this.parse(input) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  optional() {
    return new ZOptional(this);
  }

  nullable() {
    return this;
  }
}

export const z = {
  string: () => new ZString(),
  object: <S extends Shape>(shape: S) => new ZObject(shape),
  number: () => new ZNumber(),
  array: <T>(schema: BaseSchema<T>) => new ZArray(schema),
  enum: <T extends string>(values: readonly T[]) => new ZEnum(values),
};

export type infer<T extends BaseSchema<unknown>> = T extends BaseSchema<infer R> ? R : never;
