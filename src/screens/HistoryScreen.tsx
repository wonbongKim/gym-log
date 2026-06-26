import styles from './Screen.module.css'

export function HistoryScreen() {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>기록</h1>
      </header>
      <section className={styles.placeholder}>
        날짜별 운동 기록 · JSON 내보내기/가져오기
      </section>
    </main>
  )
}
