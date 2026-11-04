export function Icon({
  name,
  sprite = 'standard',
  size = 'small',
  className = '',
}: {
  name: string;
  sprite?: 'standard' | 'utility' | 'action';
  size?: 'x-small' | 'small' | 'medium' | 'large';
  className?: string;
}) {
  const sizeClass = size === 'medium' ? '' : ` slds-icon_${size}`;
  return (
    <svg className={`slds-icon${sizeClass} ${className}`} aria-hidden="true">
      <use href={`/slds/icons/${sprite}-sprite/svg/symbols.svg#${name}`} />
    </svg>
  );
}

export function IconBox({ name, size = 'medium' }: { name: string; size?: 'small' | 'medium' | 'large' }) {
  return (
    <span className={`slds-icon_container slds-icon-standard-${name}`} title={name}>
      <Icon name={name} size={size} />
    </span>
  );
}
