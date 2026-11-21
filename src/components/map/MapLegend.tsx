export function MapLegend() {
  const item = (swatch: React.ReactNode, label: string) => (
    <li className="flex items-center gap-2">{swatch}<span>{label}</span></li>
  );
  const dot = (cls: string, glyph = "") => (
    <span aria-hidden className={`cr-marker cr-marker-${cls} !size-6 !text-[11px]`}>{glyph}</span>
  );
  const line = (style: string) => <svg aria-hidden width="36" height="10"><line x1="2" y1="5" x2="34" y2="5" style={{ stroke: `var(${style.split("|")[0]})`, strokeWidth: 5, strokeDasharray: style.split("|")[1] ?? "none", strokeLinecap: "round" }} /></svg>;
  return (
    <div className="surface-card p-4">
      <h2 className="text-base font-bold">Map legend</h2>
      <ul className="mt-2 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
        {item(dot("destination", "D"), "Building / destination")}
        {item(dot("entrance", "E"), "Entrance")}
        {item(dot("lift", "L"), "Lift")}
        {item(dot("ramp", "R"), "Ramp")}
        {item(dot("barrier", "!"), "Reported barrier")}
        {item(<span aria-hidden className="cr-marker cr-marker-junction cr-marker-unverified !size-5" />, "Dashed outline = not verified")}
        {item(line("--map-verified"), "Verified pathway")}
        {item(line("--map-unverified|8 6"), "Unverified pathway or steps")}
        {item(line("--map-blocked|3 6"), "Blocked pathway")}
        {item(line("--map-route"), "Recommended route")}
        {item(line("--map-alt|12 8"), "Alternative route")}
        {item(line("--map-route|2 8"), "Unverified section of a route")}
      </ul>
    </div>
  );
}
