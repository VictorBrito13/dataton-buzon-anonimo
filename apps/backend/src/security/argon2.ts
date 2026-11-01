import argon2 from "argon2";

export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const hashSecret = (secret: string): Promise<string> => argon2.hash(secret, ARGON2_OPTIONS);

export const verifySecret = (hash: string, secret: string): Promise<boolean> =>
  argon2.verify(hash, secret);
