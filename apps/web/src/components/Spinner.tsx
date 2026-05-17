import styles from './Spinner.module.scss';

interface Props {
  size?: number;
  label?: string;
  inline?: boolean;
}

export function Spinner({ size = 20, label = 'Loading', inline = false }: Props) {
  return (
    <span
      className={inline ? styles.inline : styles.block}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span
        className={styles.spinner}
        style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 10)) }}
        aria-hidden
      />
      {!inline && <span className={styles.text}>{label}…</span>}
    </span>
  );
}
