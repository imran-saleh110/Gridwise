function apiUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL;

  if (!url && process.env.VERCEL) {
    throw new Error("NEXT_PUBLIC_API_URL must be set for Vercel deployments");
  }

  return url ?? "http://localhost:3001";
}

export function trpcUrl() {
  return `${apiUrl()}/trpc`;
}
