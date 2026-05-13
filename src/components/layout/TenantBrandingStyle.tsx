export default function TenantBrandingStyle({ branding }: { branding: Record<string, unknown> }) {
  const primary     = (branding.primary_color as string)      ?? '#1f6feb';
  const primaryDark = (branding.primary_color_dark as string) ?? '#13469a';
  // CSS variables que sobreescriben el tema en runtime.
  const css = `:root { --brand: ${primary}; --brand-dark: ${primaryDark}; }`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
