import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/* 開發期錯誤浮層：手機上無從開控制台，未捕獲之錯只見白屏。
   此層把錯誤與堆棧直接印在頁面上，便於真機點檢。僅 DEV，不入打包。 */
if (import.meta.env.DEV) {
  const show = (title, detail) => {
    let box = document.getElementById('__errbox')
    if (!box) {
      box = document.createElement('div')
      box.id = '__errbox'
      box.style.cssText =
        'position:fixed;left:0;right:0;bottom:0;max-height:55vh;overflow:auto;z-index:99999;' +
        'background:#2A1416;color:#F2D7D5;border-top:2px solid #B5442D;padding:10px 12px;' +
        'font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word'
      const btn = document.createElement('button')
      btn.textContent = '清除'
      btn.style.cssText =
        'position:sticky;top:0;float:right;background:#B5442D;color:#fff;border:0;' +
        'padding:3px 10px;border-radius:3px;font:12px sans-serif'
      btn.onclick = () => box.remove()
      box.appendChild(btn)
      document.body.appendChild(box)
    }
    const p = document.createElement('div')
    p.style.cssText = 'margin-top:6px;padding-top:6px;border-top:1px solid #5A2A2E'
    p.textContent = `${title}\n${detail}`
    box.appendChild(p)
  }
  window.addEventListener('error', (e) =>
    show(`✖ ${e.message}`, e.error?.stack || `${e.filename}:${e.lineno}:${e.colno}`)
  )
  window.addEventListener('unhandledrejection', (e) =>
    show('✖ 未處理的 Promise 拒絕', e.reason?.stack || String(e.reason))
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
