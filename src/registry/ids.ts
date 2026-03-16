import { randomBytes } from "node:crypto";

export type IdGenerator = {
  generateId(prefix: string): string;
};

export function createIdGenerator(): IdGenerator {
  let counter = 0;
  const instanceId = randomBytes(4).toString("hex");

  return {
    generateId(prefix: string): string {
      return `${prefix}_${instanceId}_${(++counter).toString().padStart(6, "0")}`;
    },
  };
}
