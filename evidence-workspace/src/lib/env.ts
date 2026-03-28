const requiredForRuntime = ["DATABASE_URL", "NEXTAUTH_SECRET"] as const;

export function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export function assertCoreEnv() {
  for (const key of requiredForRuntime) {
    requireEnv(key);
  }
}

export function getArtifactsRoot() {
  return process.env.ARTIFACTS_ROOT ?? "..";
}
