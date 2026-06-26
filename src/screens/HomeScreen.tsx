import styles from './Screen.module.css'

export function HomeScreen() {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>gym-log</h1>
        <p className={styles.subtitle}>오늘도 한 세트 💪</p>
      </header>
      <section className={styles.placeholder}>
        대시보드 홈 (이어하기 · 주간 요약 · 오늘의 루틴 · 최근 기록)
      </section>
    </main>
  )
}
