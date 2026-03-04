// Server-only Strapi fetch helper
export async function strapiFetch<T>(
  path: string,
  options?: { revalidate?: number }
): Promise<T> {
  const baseUrl = process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL;
  if (!baseUrl) throw new Error("Missing CMS_URL / NEXT_PUBLIC_CMS_URL");

  const token = process.env.STRAPI_API_TOKEN;
  if (!token) throw new Error("Missing STRAPI_API_TOKEN");

  const url = `${baseUrl.replace(/\/$/, "")}/api${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: options?.revalidate ?? 60 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Strapi fetch failed (${res.status}) ${url}\n${body}`);
  }

  return res.json() as Promise<T>;
}