/**
 * ServiceTag — Canonical service tag pill.
 *
 * Brand-blue pill with black mono lowercase text, per the Figma
 * "service-tag" component. Reused anywhere a serviceTag document
 * is displayed as a label (project detail blurb, next-project card).
 *
 * Display-only — for the interactive filter pills see FilterBar.
 *
 * @param {Object} props
 * @param {string} props.name - Service tag display name (e.g. "Live Visuals")
 */
export default function ServiceTag({ name }) {
  return <span className="service-tag">{name.toLowerCase()}</span>;
}
