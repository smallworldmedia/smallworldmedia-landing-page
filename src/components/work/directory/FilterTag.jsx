/**
 * FilterTag — one service tag in the Project Directory's filter
 * (DirectoryFilter, 11-03): a checkbox button, its square-eye indicator
 * (CheckIndicator) before the label, the name as stored in Sanity (Title
 * Case, no transform), in the drawer's client-name type. ServiceTag is the
 * read-only pill the detail pages show; this is the control. The clients tab
 * (SQ-21) lists clients on the same row ({ name, slug } is all it reads).
 *
 * `dim`: the active client would empty it (a client: the picked tags would) —
 * shown at 0.35, aria-disabled, and a click does nothing. A shut filter or a
 * hidden tab makes its whole panel inert (DirectoryFilter).
 */
import CheckIndicator from '../../ui/CheckIndicator.jsx';

export default function FilterTag({ tag, checked, dim = false, onToggle }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={dim || undefined}
      className="filter-tag"
      data-slug={tag.slug}
      data-dim={dim || undefined}
      onClick={() => {
        if (!dim) onToggle(tag.slug);
      }}
    >
      <CheckIndicator checked={checked} variant="square-eye" className="filter-tag__check" />
      <span className="filter-tag__label">{tag.name}</span>
    </button>
  );
}
