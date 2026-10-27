// 휴식 종료 알림 — 진동과 소리(비프음). PWA 운동 진행 화면에서 쓴다.
//
// 한계(기기·브라우저마다 다르다):
//   · 진동: Vibration API를 지원하는 브라우저(주로 Android의 Chrome·삼성 인터넷)만. iPhone(사파리)은 지원하지 않는다.
//   · 소리: Web Audio로 직접 만든 비프음이라 파일이 필요 없다. 브라우저 정책상 사용자가 화면을 누른 뒤에야 소리를 낼 수 있어서,
//     세트 완료 버튼을 누를 때 unlockAudio()로 미리 열어 둔다. 기기가 무음 모드면 안 들릴 수 있다.
//   · 화면이 꺼지거나 앱이 백그라운드이면 브라우저가 타이머를 늦추거나 멈춘다 — "운동 중 화면 꺼짐 방지"를 켜 두면 화면이 켜져 있어 정상 동작한다.

let ctx = null

export function vibrationSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

// 사용자가 화면을 눌렀을 때 호출해서 오디오를 쓸 수 있는 상태로 만든다
export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = ctx || new AC()
    if (ctx.state === 'suspended') ctx.resume()
  } catch {
    /* 오디오를 못 쓰는 환경이면 소리 없이 진행 */
  }
}

// 짧은 비프음 두 번
function beep() {
  try {
    if (!ctx) return
    const start = ctx.currentTime
    ;[0, 0.28].forEach(offset => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start + offset)
      osc.stop(start + offset + 0.22)
    })
  } catch {
    /* 소리 실패는 무시 */
  }
}

// 휴식이 끝났을 때 설정에 따라 진동·소리를 낸다. 실제로 시도한 것을 돌려준다(테스트 버튼 안내용).
export function notifyRestEnd({ vibrate = true, sound = false } = {}) {
  const result = { vibrated: false, sounded: false }
  if (vibrate && vibrationSupported()) result.vibrated = navigator.vibrate([200, 100, 200])
  if (sound) {
    unlockAudio()
    beep()
    result.sounded = !!ctx
  }
  return result
}
