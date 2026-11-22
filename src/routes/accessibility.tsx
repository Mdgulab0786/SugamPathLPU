import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";

export const Route = createFileRoute("/accessibility")({
  head: () => ({
    meta: [
      { title: "Accessibility statement – SugamPath LPU" },
      { name: "description", content: "SugamPath LPU's commitment to WCAG 2.2 AA: keyboard access, screen-reader support, high contrast and written route directions." },
      { property: "og:title", content: "Accessibility statement – SugamPath LPU" },
      { property: "og:description", content: "How the SugamPath LPU website itself is designed to be accessible." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Statement,
});

function Statement() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <PageHeader eyebrow="Accessibility" title="Accessibility statement" />
      <div className="space-y-5 text-lg leading-relaxed">
        <p>SugamPath LPU aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Every page can be used with a keyboard, with a visible focus outline and a "Skip to main content" link.</li>
          <li>Forms have visible labels and clear error messages; statuses use text and icons, never colour alone.</li>
          <li>Text uses the Atkinson Hyperlegible typeface, a large base size, and high-contrast colours. Text can be enlarged with browser zoom.</li>
          <li>Every route includes written step-by-step directions, so the map is never the only way to understand a route.</li>
          <li>Animations are minimal and respect your device's reduced-motion setting.</li>
        </ul>
        <h2 className="text-2xl font-bold">Known limitations</h2>
        <p>The interactive map relies on third-party map tiles. All information on the map is also available as text in the detail panel, route details and lift list.</p>
        <h2 className="text-2xl font-bold">Feedback</h2>
        <p>If something on this website is hard to use, please <Link to="/report" className="font-semibold text-primary underline underline-offset-4">submit a report</Link> using the "Other accessibility issue" category.</p>
      </div>
    </div>
  );
}
