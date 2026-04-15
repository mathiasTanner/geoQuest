import { getSiteFooter } from "@/lib/strapi/footer";
import Container from "@/components/layout/Container";

export default async function Footer() {
  const footer = await getSiteFooter();

  return (
    <footer className="border-t border-border bg-card text-card-foreground">
      <Container className="py-6 text-sm">
        <div className="font-semibold">{footer.brandName}</div>

        {footer.tagline ? (
          <div className="mt-2 text-muted-foreground">{footer.tagline}</div>
        ) : null}

        {footer.copyrightText ? (
          <div className="mt-4 text-muted-foreground">
            {footer.copyrightText}
          </div>
        ) : null}
      </Container>
    </footer>
  );
}