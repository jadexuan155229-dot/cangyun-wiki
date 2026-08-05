import { useState } from 'react'
import CangyunWiki from './cangyun-wiki.jsx'
import Landing from './landing.jsx'

/* 定場僅攔「裸址直達」：帶哈希深鏈（自分享而來）與同會話再訪皆直入站內 */
function wantLanding() {
  if (/#\/./.test(window.location.hash)) return false
  try {
    if (sessionStorage.getItem('cy-landing-seen')) return false
  } catch { /* 讀不到就當首訪 */ }
  return true
}

function App() {
  const [landing, setLanding] = useState(wantLanding)
  /* 定場覆於站內之上，站內照常掛載——鈐印離場即無縫露出，不另起加載 */
  return (
    <>
      <CangyunWiki onOpenLanding={() => setLanding(true)} />
      {landing && <Landing onEnter={() => setLanding(false)} />}
    </>
  )
}

export default App
