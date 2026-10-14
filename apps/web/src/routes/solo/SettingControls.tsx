type ChoiceProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function SettingSwitch({ label, checked, onChange, disabled }: ChoiceProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span>{label}</span>
      <span aria-hidden="true" className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/25'}`}>
        <span className={`h-5 w-5 rounded-full bg-white transition-transform motion-reduce:transition-none ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  );
}

export function DayChoice({ label, checked, onChange, disabled }: ChoiceProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`min-h-11 min-w-11 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${checked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'}`}
    >
      {label}
    </button>
  );
}
