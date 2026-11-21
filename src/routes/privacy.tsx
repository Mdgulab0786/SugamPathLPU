import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy – ClearRoute" },
      { name: "description", content: "What ClearRoute collects, why, and how barrier reports and optional location data are protected." },
      { property: "og:title", content: "Privacy policy – ClearRoute" },
      { property: "og:description", content: "ClearRoute's simple privacy statement." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <PageHeader eyebrow="Privacy" title="Privacy policy" />
      <div className="space-y-5 text-lg leading-relaxed">
        <h2 className="text-2xl font-bold">What we collect</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>Accounts:</strong> your email address and an optional display name.</li>
          <li><strong>Barrier reports:</strong> the category, location, description, time and an optional photo you choose to submit. We never ask for medical diagnoses.</li>
          <li><strong>Location:</strong> only when you press a "use my location" button, only once, and only for that action. ClearRoute never tracks you continuously.</li>
          <li><strong>Abuse prevention:</strong> a one-way hash of your network address is kept for one hour-based rate limiting of reports; the address itself is not stored.</li>
        </ul>
        <h2 className="text-2xl font-bold">Who can see it</h2>
        <p>Your reports are visible to you and to authorised estate staff. The public map shows only a report's category, location and status — never descriptions, photos or who submitted it. Anonymous reports are not linked to any account.</p>
        <h2 className="text-2xl font-bold">Photos</h2>
        <p>Photos are stored privately and are only viewable by estate staff and, for signed-in reporters, by you. Please avoid photographing people.</p>
        <h2 className="text-2xl font-bold">Your choices</h2>
        <p>You can use ClearRoute as a guest without an account, and submit reports anonymously.</p>
      </div>
    </div>
  );
}
