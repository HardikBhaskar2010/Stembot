import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { haptic } from '../platform/feedback';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'glass' | 'primary' | 'caramel' | 'quiet';
  size?: 'md' | 'lg';
  block?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = 'glass',
  size = 'md',
  block,
  icon,
  className = '',
  children,
  ...rest
}: BtnProps) {
  const v =
    variant === 'primary'
      ? 'glass glass--signal glass-i'
      : variant === 'caramel'
        ? 'glass glass--caramel glass-i'
        : variant === 'quiet'
          ? 'btn--quiet'
          : 'glass glass-i';
  return (
    <button
      type="button"
      className={`btn ${v} ${size === 'lg' ? 'btn--lg' : ''} ${block ? 'btn--block' : ''} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  glass = false,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; glass?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-btn ${glass ? 'glass glass-i' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  labelledBy,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  labelledBy?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      className="switch"
      onClick={() => {
        haptic('tap');
        onChange(!checked);
      }}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  tint = 'glass--signal',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  tint?: string;
}) {
  const i = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const move = (dir: 1 | -1) => {
    const next = options[(i + dir + options.length) % options.length];
    if (next) onChange(next.value);
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="segmented glass"
      style={{ ['--n' as string]: options.length, ['--i' as string]: i }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          move(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      <span className={`segmented__lens glass ${tint}`} aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className="segmented__opt"
          onClick={() => {
            haptic('tap');
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  valueText,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
  valueText?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="slider"
      aria-label={label}
      aria-valuetext={valueText}
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ ['--val' as string]: `${pct}%` }}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function Row({
  label,
  hint,
  control,
  id,
}: {
  label: string;
  hint?: string;
  control: ReactNode;
  id?: string;
}) {
  const auto = useId();
  const labelId = id ?? auto;
  return (
    <div className="row">
      <div className="row__text">
        <div className="row__label" id={labelId}>
          {label}
        </div>
        {hint && <div className="row__hint">{hint}</div>}
      </div>
      {control}
    </div>
  );
}

export function Bars({ level, label }: { level: number | null; label: string }) {
  return (
    <span className="bars" data-level={level ?? 0} role="img" aria-label={label}>
      <i />
      <i />
      <i />
    </span>
  );
}
