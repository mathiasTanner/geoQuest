import Container from "@/components/layout/Container";
import { strapiFetch } from "@/lib/strapi/strapiFetch";

type Page = {
  title: string;
  slug: string;
  content?: string;
};

async function getPage(slug: string): Promise<Page | null> {
  const res = await strapiFetch<any>(
    `/pages?filters[slug][$eq]=${slug}`
  );

  const page = res?.data?.[0];

  if (!page) return null;

  const raw = page.attributes ?? page;

  return {
    title: raw.title,
    slug: raw.slug,
    content: raw.content,
  };
}

export default async function Page({
  params,
}: {
  params: { slug: string };
}) {
  const page = await getPage(params.slug);

  if (!page) {
    return <div>Page not found</div>;
  }

  return (
    <Container className="py-8">
        <h1 className="text-3xl font-semibold">{page.title}</h1>

        {page.content ? (
        <div className="mt-6">{page.content}</div>
        ) : null}
    </Container>
  );
}