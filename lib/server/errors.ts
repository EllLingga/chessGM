export class ConfigError extends Error {}
export class UserError extends Error {}
export class ProviderError extends Error {
  status: number;
  constructor(m: string, s = 0) { super(m); this.status = s; }
}
