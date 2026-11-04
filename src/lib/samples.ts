import type { ParsedRoutine } from './routineImport'

/** 첫 실행 온보딩용 예시 루틴 (README 예시와 동일) */
export const SAMPLE_ROUTINES: ParsedRoutine[] = [
  {
    name: '월요일 - 가슴/등/삼두 (상체 A)',
    days: ['mon'],
    exercises: [
      { name: '벤치프레스', targetSets: 3, targetReps: '8~10' },
      { name: '어시스트 턱걸이', targetSets: 3, targetReps: '10~12' },
      { name: '인클라인 벤치프레스', targetSets: 2, targetReps: '10~12' },
      { name: '시티드 로우', targetSets: 2, targetReps: '10~12' },
      { name: '사이드 레터럴 레이즈', targetSets: 3, targetReps: '15~20' },
      { name: '케이블 푸시다운', targetSets: 3, targetReps: '12~15' },
      { name: '덤벨 오버헤드 트라이셉스 익스텐션', targetSets: 3, targetReps: '12~15' },
    ],
  },
  {
    name: '수요일 - 하체',
    days: ['wed'],
    exercises: [
      { name: '레그프레스', targetSets: 4, targetReps: '12~15' },
      { name: '레그 익스텐션', targetSets: 4, targetReps: '15~20' },
      { name: '루마니안 데드리프트', targetSets: 4, targetReps: '10~12' },
      { name: '레그컬', targetSets: 4, targetReps: '12~15' },
      { name: '복근 운동', targetSets: 4, targetReps: '실패 지점까지' },
    ],
  },
  {
    name: '금요일 - 어깨/등/이두 (상체 B)',
    days: ['fri'],
    exercises: [
      { name: '숄더프레스', targetSets: 3, targetReps: '8~10' },
      { name: '어시스트 턱걸이', targetSets: 3, targetReps: '10~12' },
      { name: '벤치프레스', targetSets: 2, targetReps: '10~12' },
      { name: '시티드 로우', targetSets: 2, targetReps: '10~12' },
      { name: '사이드 레터럴 레이즈', targetSets: 3, targetReps: '15~20' },
      { name: '해머컬', targetSets: 3, targetReps: '12~15' },
      { name: '덤벨 바이셉스 컬', targetSets: 3, targetReps: '12~15' },
    ],
  },
]
