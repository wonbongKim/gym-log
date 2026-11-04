import { Copy, Check } from 'lucide-react'
import { OverlayPage, PageBody, TopBar, TopBarAction } from '../components/Page'
import { useClipboard } from '../hooks/useClipboard'
import own from './RoutineImport.module.css'

/** JSON 읽기 전용 뷰 + 복사 (상태 기반 오버레이) */
export function RoutineJsonView({
  json,
  title,
  onClose,
}: {
  json: string
  title: string
  onClose: () => void
}) {
  const { copied, copy } = useClipboard()

  return (
    <OverlayPage>
      <TopBar
        onBack={onClose}
        backIcon="close"
        title={title}
        right={
          <TopBarAction onClick={() => copy(json)}>
            {copied ? (
              <>
                <Check size={16} /> 복사됨
              </>
            ) : (
              <>
                <Copy size={16} /> 복사
              </>
            )}
          </TopBarAction>
        }
      />
      <PageBody>
        <textarea
          className={`${own.textarea} ${own.viewer}`}
          value={json}
          readOnly
          spellCheck={false}
          onFocus={(e) => e.currentTarget.select()}
        />
      </PageBody>
    </OverlayPage>
  )
}
