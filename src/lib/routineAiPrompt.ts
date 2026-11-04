/** 사용자가 직접 바꿀 자리 (요청을 비워 두면 그대로 들어간다) */
export const AI_REQUEST_PLACEHOLDER =
  '[여기에 원하는 변경사항을 적어주세요: 예) 무릎 부담 줄인 하체 루틴으로 바꿔줘]'

/**
 * AI 채팅(ChatGPT·Gemini·Claude 등)에 붙여넣을 루틴 요청문.
 * 앱은 API를 호출하지 않는다 — 복사/붙여넣기 전용.
 *
 * @param currentJson routinesToCompactJson()/routinesToImportJson()으로 만든 현재 루틴 JSON (없으면 null)
 * @param request 사용자가 앱에서 미리 적은 요청 (비어 있으면 placeholder)
 */
export function buildRoutineAiPrompt(currentJson: string | null, request?: string): string {
  const req = request?.trim() || AI_REQUEST_PLACEHOLDER
  const current = currentJson
    ? ['```json', currentJson, '```'].join('\n')
    : '아직 등록한 루틴이 없어요. 새로 만들어 주세요.'

  return `[gym-log 루틴 요청]
저는 'gym-log'라는 개인 운동 기록 앱을 쓰고 있어요. 앱에 그대로 붙여넣어 적용할 수 있도록, 아래 형식의 JSON으로 루틴을 만들어 주세요. 맨 아래 '원하는 변경사항'을 반영해 주세요.

■ JSON 형식
- 최상위는 루틴 배열이에요: [ {루틴}, {루틴}, ... ]
- 루틴
  - "id": 기존 루틴을 수정할 때는 '현재 루틴'에 있는 id를 바꾸지 말고 그대로 두세요. 새로 만드는 루틴은 id를 빼 주세요.
  - "name": 루틴 이름 (예: "월요일 - 가슴/삼두")
  - "days": 요일 배열. "mon", "tue", "wed", "thu", "fri", "sat", "sun" 중에서 골라요.
  - "exercises": 수행 순서대로 나열한 종목 배열
- 종목
  - "name": 종목 이름(한국어). 이미 있는 종목은 철자를 똑같이 써 주세요. 이름이 같아야 지난 기록과 이어져요.
  - "targetSets": 세트 수 (숫자)
  - "targetReps": 목표 횟수 (문자열, 예: "8~10", "12", "실패 지점까지")
  - "note": (선택) 짧은 수행 팁, 예: "템포 3-1-1", "무릎 아프면 가동범위 줄이기"
  - "alternatives": (선택) 기구가 사용 중일 때 대신할 종목 이름 배열, 예: ["덤벨 벤치프레스", "체스트 프레스 머신"]

예시:
[
  {
    "name": "월요일 - 가슴/삼두",
    "days": ["mon"],
    "exercises": [
      { "name": "벤치프레스", "targetSets": 3, "targetReps": "8~10", "note": "2초 동안 내리기", "alternatives": ["덤벨 벤치프레스", "체스트 프레스 머신"] },
      { "name": "케이블 푸시다운", "targetSets": 3, "targetReps": "12~15" }
    ]
  }
]

■ 무게 표기 규칙 (note 등에 무게를 적을 때)
- 단위는 kg
- 바벨은 빈 봉을 뺀 원판 무게만 적어요. 0 = 빈 봉만
- 비어 있음/null = 맨몸
- 음수 = 어시스트(보조) 무게예요. 예: -20 = 20kg 보조

■ 답변 규칙
- 바꾸지 않는 루틴도 빠짐없이 넣어서 '전체 루틴 목록'으로 답해 주세요. 목록에서 뺀 루틴은 삭제될 수 있어요.
- 수정한 루틴은 id를 그대로 유지하고, 새 루틴은 id를 빼 주세요.
- 설명 없이 JSON만 코드 블록 하나로 답해 주세요.
- '원하는 변경사항'에 대괄호 안내 문구만 있고 실제 요청이 없으면, JSON을 만들기 전에 무엇을 바꾸고 싶은지 먼저 물어봐 주세요.

■ 현재 루틴
${current}

■ 원하는 변경사항
${req}
`
}
