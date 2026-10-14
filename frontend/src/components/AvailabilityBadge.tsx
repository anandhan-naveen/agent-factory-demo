interface Props {
  available: boolean;
}

export function AvailabilityBadge({ available }: Readonly<Props>) {
  return (
    <span className={`badge ${available ? 'badge--available' : 'badge--loan'}`} data-testid="availability-badge">
      <span className="badge__dot" aria-hidden="true" />
      {available ? 'Available' : 'On loan'}
    </span>
  );
}
