import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CircleCheck, CircleAlert, Info } from 'lucide-react'
import { Button } from './Button'
import { Sheet } from './Sheet'
import { storage, StorageQuotaError } from '../storage'
import { defaultPruneCount, pruneOldest } from '../lib/storageCare'
import { downloadBackup } from '../lib/backup'
import styles from './DialogProvider.module.css'

// 브라우저 기본 confirm/alert 대신 쓰는 앱 공용 다이얼로그 · 토스트

export interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

export interface ChooseOption<T> {
  label: string
  value: T
  variant?: 'primary' | 'ghost' | 'danger'
}

export interface ChooseOptions<T> {
  title: string
  message?: ReactNode
  options: ChooseOption<T>[]
  cancelText?: string
}

export interface ToastOptions {
  type?: 'info' | 'success' | 'error'
  action?: { label: string; onClick: () => void }
  duration?: number
}

interface DialogApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>
  choose: <T>(o: ChooseOptions<T>) => Promise<T | null>
  toast: (message: string, o?: ToastOptions) => void
}

const DialogContext = createContext<DialogApi | null>(null)

interface ActiveDialog {
  title: string
  message?: ReactNode
  options: ChooseOption<unknown>[]
  cancelText: string
  resolve: (v: unknown) => void
}

interface ActiveToast extends ToastOptions {
  id: number
  message: string
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ActiveDialog | null>(null)
  const [toast, setToast] = useState<ActiveToast | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const toastSeq = useRef(0)

  const choose = useCallback(<T,>(o: ChooseOptions<T>) => {
    return new Promise<T | null>((resolve) => {
      setDialog({
        title: o.title,
        message: o.message,
        options: o.options as ChooseOption<unknown>[],
        cancelText: o.cancelText ?? '취소',
        resolve: resolve as (v: unknown) => void,
      })
    })
  }, [])

  const confirm = useCallback(
    async (o: ConfirmOptions) => {
      const r = await choose<boolean>({
        title: o.title,
        message: o.message,
        cancelText: o.cancelText,
        options: [
          {
            label: o.confirmText ?? '확인',
            value: true,
            variant: o.danger ? 'danger' : 'primary',
          },
        ],
      })
      return r === true
    },
    [choose],
  )

  const showToast = useCallback((message: string, o: ToastOptions = {}) => {
    window.clearTimeout(toastTimer.current)
    toastSeq.current += 1
    setToast({ id: toastSeq.current, message, ...o })
    toastTimer.current = window.setTimeout(
      () => setToast(null),
      o.duration ?? (o.action ? 5000 : 2400),
    )
  }, [])

  // 저장 실패 알림. 용량 초과면 "오래된 기록부터 정리"를 제안 (연속 입력 중 중복 방지)
  const quotaPromptAt = useRef(0)
  useEffect(
    () =>
      storage.onError(async (e) => {
        if (!(e instanceof StorageQuotaError)) {
          showToast('저장에 실패했어요.', { type: 'error', duration: 4000 })
          return
        }
        if (Date.now() - quotaPromptAt.current < 30_000) return
        quotaPromptAt.current = Date.now()
        const n = defaultPruneCount()
        if (n === 0) {
          showToast('저장 공간이 가득 찼어요. 같은 사이트의 다른 데이터가 공간을 쓰고 있어요.', {
            type: 'error',
            duration: 6000,
          })
          return
        }
        const choice = await choose<'backup' | 'prune'>({
          title: '저장 공간이 가득 찼어요',
          message: `방금 입력한 내용이 저장되지 않았어요.\n가장 오래된 기록 ${n}개를 지워 공간을 만들까요? 지우기 전에 백업을 추천해요.`,
          options: [
            { label: '백업 받고 오래된 기록 정리', value: 'backup' },
            { label: '바로 정리', value: 'prune', variant: 'danger' },
          ],
          cancelText: '나중에',
        })
        if (!choice) return
        if (choice === 'backup') downloadBackup()
        const res = pruneOldest(n)
        showToast(`오래된 기록 ${res.removed.length}개(${res.range})를 정리했어요. 다시 입력해 주세요.`, {
          type: 'success',
          duration: 5000,
        })
      }),
    [showToast, choose],
  )

  const close = (value: unknown) => {
    dialog?.resolve(value)
    setDialog(null)
  }

  const api = useMemo<DialogApi>(
    () => ({ confirm, choose, toast: showToast }),
    [confirm, choose, showToast],
  )

  const ToastIcon =
    toast?.type === 'success' ? CircleCheck : toast?.type === 'error' ? CircleAlert : Info

  return (
    <DialogContext.Provider value={api}>
      {children}

      {dialog && (
        <Sheet
          title={dialog.title}
          description={dialog.message}
          onClose={() => close(null)}
          labelledBy="app-dialog-title"
        >
          <div className={styles.actions}>
            {dialog.options.map((opt, i) => (
              <Button
                key={i}
                block
                variant={opt.variant === 'danger' ? 'dangerSolid' : opt.variant ?? 'primary'}
                onClick={() => close(opt.value)}
                autoFocus={i === 0}
              >
                {opt.label}
              </Button>
            ))}
            <Button block variant="ghost" onClick={() => close(null)}>
              {dialog.cancelText}
            </Button>
          </div>
        </Sheet>
      )}

      <div className={styles.toastWrap} aria-live="polite">
        {toast && (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.type ?? 'info']}`}>
            <ToastIcon size={18} className={styles.toastIcon} aria-hidden />
            <span className={styles.toastMsg}>{toast.message}</span>
            {toast.action && (
              <button
                className={styles.toastAction}
                onClick={() => {
                  toast.action!.onClick()
                  setToast(null)
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </DialogContext.Provider>
  )
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog must be used within DialogProvider')
  return ctx
}
