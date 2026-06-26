import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExerciseNameOf, useLogs, useSession } from './useStores'
import { seedSession } from '../lib/workout'
import type { Routine } from '../types'

/** 루틴으로 운동 세션을 시작하고 운동 화면으로 이동. 진행 중이면 확인 후 덮어쓴다. */
export function useStartWorkout() {
  const nameOf = useExerciseNameOf()
  const { lastRecordOf } = useLogs()
  const { session, setSession } = useSession()
  const navigate = useNavigate()

  return useCallback(
    (routine: Routine): boolean => {
      if (
        session &&
        !confirm(
          '진행 중인 운동이 있어요.\n새 운동을 시작하면 기존 진행 내용이 사라집니다. 계속할까요?',
        )
      ) {
        return false
      }
      setSession(seedSession(routine, nameOf, lastRecordOf))
      navigate('/workout')
      return true
    },
    [session, setSession, nameOf, lastRecordOf, navigate],
  )
}
