import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// PWA(/mobile) 뒤로가기 — "이전에 본 화면"이 아니라 항상 "상위 화면"으로 간다.
//   · 열려 있는 모달/확인이 있으면 그것부터 닫는다(useBackHandler로 등록한 것)
//   · 하위 화면(대시보드·기록·루틴·운동 리스트·설정)은 메인 메뉴로, 운동 진행은 기록으로
//   · 메인 메뉴에서는 한 번 누르면 안내만 띄우고, 2초 안에 한 번 더 누르면 앱이 종료된다
//
// 원리: 브라우저 뒤로가기(제스처·버튼)는 history 한 칸 뒤로 가는 popstate로 들어온다.
//   - 항상 [트랩, 현재 화면] 두 칸만 유지한다. 화면 이동(pushState)을 같은 자리 교체(replaceState)로 바꿔 스택이 쌓이지 않게 하고,
//     뒤로가기가 오면 트랩으로 내려오므로 그때 우리가 직접 상위 화면으로 보낸 뒤 트랩을 다시 만든다.
//   - 메인 메뉴에서 뒤로가기가 오면 트랩 위에 그대로 머문다(스택에 한 칸만 남음). 그 상태에서 한 번 더 누르면 더 내려갈 곳이 없어 시스템이 앱을 종료한다.
//     2초가 지나면 트랩을 다시 만들어 처음 상태로 돌아간다.
// 웹앱(데스크탑)에는 쓰지 않는다 — MobileApp 안에서만 켠다(Provider가 마운트돼 있을 때만 동작).
//
// ※ 중요: window의 popstate 리스너는 capture 여부와 상관없이 "등록한 순서대로" 실행된다(Chrome에서 확인).
//   라우터(BrowserRouter)는 마운트될 때 리스너를 등록하므로, 우리 리스너를 그보다 먼저(이 모듈이 import되는 시점에) 등록해야
//   stopImmediatePropagation으로 라우터가 "이전 화면"으로 이동하는 것을 막을 수 있다. 그래서 상태와 리스너를 모듈 수준에 둔다.

const BackContext = createContext(null)

const ROOT = '/mobile'
const PARENTS = { '/mobile/session': '/mobile/log' } // 그 외 /mobile 하위 화면의 상위는 메인 메뉴
const EXIT_WINDOW_MS = 2000
export const EXIT_HINT = '한번 더 뒤로가기 시, 어플이 종료됩니다.'

const normalize = pathname => pathname.replace(/\/+$/, '') || '/'
export const parentOf = pathname => {
  const p = normalize(pathname)
  return p === ROOT ? null : (PARENTS[p] ?? ROOT)
}

const nativePush = History.prototype.pushState
const nativeReplace = History.prototype.replaceState

// 모듈 수준 상태. 개발 중 HMR로 이 모듈이 다시 평가돼도 같은 객체·리스너를 쓰도록 window에 붙여 둔다.
const S = (window.__fitBack ??= {
  active: false, // Provider가 마운트돼 있을 때만 true (웹앱에서는 false라서 아무것도 가로채지 않는다)
  navigate: null,
  pathname: '/',
  url: '/',
  handlers: [],
  lonely: false, // true = 히스토리에 트랩만 남은 상태(메인에서 첫 뒤로가기 직후)
  timer: null,
  navigatedTo: null, // 핸들러가 실행되는 동안 이동한 주소(화면이 바뀌었는지 알기 위해 기록)
  setToast: () => {},
})

const stateCopy = () => ({ ...(history.state && typeof history.state === 'object' ? history.state : {}), fitGuard: true })

// 트랩을 지금 화면 주소로 맞추고 그 위에 현재 화면 칸을 하나 더 쌓는다
const restoreGuard = url => {
  nativeReplace.call(history, stateCopy(), '', url)
  nativePush.call(history, stateCopy(), '', url)
}

const disarm = () => {
  clearTimeout(S.timer)
  S.timer = null
  S.lonely = false
  S.setToast(false)
}

function onPop(ev) {
  if (!S.active) return // 웹앱이거나 아직 준비 전: 라우터가 평소대로 처리하게 둔다
  const { navigate, pathname, url } = S
  const atRoot = parentOf(pathname) === null
  // 메인에서 안내가 떠 있는 동안 한 번 더 내려온 경우(앱 종료 확인): 가로채지 않고 그대로 둔다
  if (S.lonely && atRoot && S.handlers.length === 0) return

  ev.stopImmediatePropagation() // 라우터가 "이전 화면"으로 이동하지 못하게 막는다

  if (S.handlers.length) {
    // 핸들러가 화면을 옮길 수도(운동 종료) 안 옮길 수도(모달 닫기) 있다. 트랩 주소를 먼저 지금 화면으로 맞춰 두고,
    // 핸들러가 이동했다면 그 주소로, 아니면 지금 주소로 트랩을 복구해서 화면과 주소창이 어긋나지 않게 한다.
    nativeReplace.call(history, stateCopy(), '', url)
    S.navigatedTo = null
    for (let i = S.handlers.length - 1; i >= 0; i--) {
      if (S.handlers[i]() !== false) {
        restoreGuard(S.navigatedTo ?? url)
        S.navigatedTo = null
        return
      }
    }
  }

  const parent = parentOf(pathname)
  if (parent) {
    navigate(parent, { replace: true })
    restoreGuard(parent)
    return
  }

  // 메인 메뉴: 안내를 띄우고 트랩 위에 머문다. 2초 안에 한 번 더 누르면 시스템이 앱을 종료한다.
  S.lonely = true
  S.setToast(true)
  clearTimeout(S.timer)
  S.timer = setTimeout(() => {
    const wasLonely = S.lonely
    disarm()
    if (wasLonely) restoreGuard(S.url)
  }, EXIT_WINDOW_MS)
}

if (!window.__fitBackListener) {
  window.__fitBackListener = true
  window.addEventListener('popstate', onPop, true) // 라우터보다 먼저 등록되도록 모듈이 로드될 때 바로 등록
}

export function BackNavigationProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [toast, setToast] = useState(false)

  // 최신 값은 모듈 상태에 넣어 두고 이벤트 핸들러에서 읽는다
  S.navigate = navigate
  S.pathname = location.pathname
  S.url = location.pathname + location.search + location.hash

  const api = useMemo(
    () => ({
      // 핸들러를 등록하고 해제 함수를 돌려준다. 가장 나중에 등록된 것부터 호출되고, false를 돌려주면 "처리 안 함"이라 다음으로 넘어간다.
      register: fn => {
        S.handlers.push(fn)
        return () => {
          S.handlers = S.handlers.filter(h => h !== fn)
        }
      },
    }),
    [],
  )

  useEffect(() => {
    S.active = true
    S.setToast = setToast

    // 개발 모드(StrictMode)에서 효과가 두 번 실행돼도 트랩이 중복으로 쌓이지 않게 한 번만 만든다
    if (!window.__fitBackGuard) {
      window.__fitBackGuard = true
      nativePush.call(history, stateCopy(), '', window.location.href)
    }

    // 화면 이동은 새 칸을 쌓지 않고 제자리 교체로 바꾼다. 단, 트랩만 남은 상태면 새 칸을 쌓아 [트랩, 현재 화면]을 복구한다.
    history.pushState = function (state, title, url) {
      S.navigatedTo = url
      if (S.lonely) {
        disarm()
        return nativePush.call(history, state, title, url)
      }
      return nativeReplace.call(history, state, title, url)
    }
    history.replaceState = function (state, title, url) {
      S.navigatedTo = url
      return nativeReplace.call(history, state, title, url)
    }

    return () => {
      S.active = false
      S.setToast = () => {}
      delete history.pushState // 우리가 덮어쓴 것을 걷어내 원래 함수로 돌아간다
      delete history.replaceState
      clearTimeout(S.timer)
    }
  }, [])

  return (
    <BackContext.Provider value={api}>
      {children}
      {toast && (
        <div role="status" aria-live="polite" className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[300] max-w-[90vw] px-4 py-2.5 rounded-full bg-gray-800 text-white text-m-body font-bold shadow-lg text-center fade-in">
          {EXIT_HINT}
        </div>
      )}
    </BackContext.Provider>
  )
}

// 모달·확인 화면이 떠 있는 동안 뒤로가기를 가로채 닫는다. fn이 false를 돌려주면 "처리 안 함"(상위 화면으로 이동).
// Provider 밖(웹앱)에서는 아무 일도 하지 않는다.
export function useBackHandler(fn, enabled = true) {
  const api = useContext(BackContext)
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!api || !enabled) return
    return api.register(() => ref.current())
  }, [api, enabled])
}
