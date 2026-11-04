import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExerciseNameOf, useLogs, useSession } from './useStores'
import { useDialog } from '../components/DialogProvider'
import { seedSession } from '../lib/workout'
import type { Routine } from '../types'

/** 루틴으로 운동 세션을 시작하고 운동 화면으로 이동. 진행 중이면 확인 후 덮어쓴다. */
export function useStartWorkout() {
  const nameOf = useExerciseNameOf()
  const { lastRecordOf } = useLogs()
  const { session, setSession } = useSession()
  const { choose } = useDialog()
  const navigate = useNavigate()

  return useCallback(
    async (routine: Routine): Promise<boolean> => {
      if (session) {
        const r = await choose<'resume' | 'replace'>({
          title: '진행 중인 운동이 있어요',
          message: `'${session.routineName}' 운동을 이어서 할까요?\n새로 시작하면 진행 중인 내용은 사라져요.`,
          options: [
            { label: '진행 중인 운동 이어하기', value: 'resume', variant: 'primary' },
            { label: `'${routine.name}' 새로 시작`, value: 'replace', variant: 'danger' },
          ],
        })
        if (r === 'resume') {
          navigate('/workout')
          return false
        }
        if (r !== 'replace') return false
      }
      setSession(seedSession(routine, nameOf, (id) => lastRecordOf(id, routine.id)))
      navigate('/workout')
      return true
    },
    [session, setSession, nameOf, lastRecordOf, navigate, choose],
  )
}
