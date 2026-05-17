import styles from './page.module.scss';

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <h1>Workforce Optimizer</h1>
        <p>Bachelor thesis MVP — skeleton boot.</p>
        <p className={styles.muted}>
          API: <code>http://localhost:4000/api/health</code>
        </p>
      </section>
    </main>
  );
}
