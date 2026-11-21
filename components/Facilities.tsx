// Facility chips and photo grid, used on the staff branch page and in the parent app.
import { displayFacilities } from '@/lib/facilities';

export function FacilityChips({ json, empty }: { json: string | null; empty?: React.ReactNode }) {
  const items = displayFacilities(json);
  if (!items.length) return <>{empty ?? null}</>;
  return (
    <ul className="facility-chips">
      {items.map((f) => (
        <li key={f.label}>
          <span aria-hidden>{f.emoji}</span> {f.label}
          {f.detail && <small> · {f.detail}</small>}
        </li>
      ))}
    </ul>
  );
}

export function PhotoGrid({ photos, action }: { photos: { id: string; caption: string | null }[]; action?: (id: string) => React.ReactNode }) {
  if (!photos.length) return null;
  return (
    <div className="photo-grid">
      {photos.map((p) => (
        <figure key={p.id}>
          <a href={`/api/branch-photo/${p.id}`} target="_blank" rel="noopener noreferrer">
            <img src={`/api/branch-photo/${p.id}`} alt={p.caption ?? 'Branch photo'} loading="lazy" />
          </a>
          {p.caption && <figcaption>{p.caption}</figcaption>}
          {action && <div className="photo-grid-action">{action(p.id)}</div>}
        </figure>
      ))}
    </div>
  );
}
