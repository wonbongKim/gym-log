import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * 오버레이 닫기: 앱 안에서 들어왔으면 history back,
 * 링크로 바로 열렸으면(첫 진입) fallback 경로로 교체.
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(() => {
    if (location.key !== 'default') navigate(-1)
    else navigate(fallback, { replace: true })
  }, [navigate, location.key, fallback])
}
