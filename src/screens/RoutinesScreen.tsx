import styles from './Screen.module.css'

export function RoutinesScreen() {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>루틴</h1>
      </header>
      <section className={styles.placeholder}>
        루틴 목록 · 추가/수정/삭제 · 종목 관리
      </section>
    </main>
  )
}
