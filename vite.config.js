import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 文庫正文提及計數（構建期算，供人物檔案「見於文庫」面板）。
// 正文已切為懶加載塊、不入主包（見 src/novel/texts.js）；但檔案卡要顯示
// 各章提及次數，若運行時去數就得把整部正文拉進來、廢了懶加載。故在此於
// 構建期直接讀原始 .txt，按本名精確計數（與舊 mentionGroups 同法：非重疊、
// 步進本名長度），產出微小映射 { 相對novel檔名: { 人物id: 次數 } } 作虛擬模組
// `virtual:novel-mentions`。人物名、章節結構在應用側，故此處只按檔名為鍵。
function novelMentions() {
  const V = 'virtual:novel-mentions'
  const RESOLVED = '\0' + V
  const NOVEL_DIR = fileURLToPath(new URL('./src/novel/', import.meta.url))
  const DATA = fileURLToPath(new URL('./src/cangyun-data.js', import.meta.url))
  const listTxt = (dir, base = '') => {
    const out = []
    for (const name of readdirSync(dir)) {
      const p = dir + name
      if (statSync(p).isDirectory()) out.push(...listTxt(p + '/', base + name + '/'))
      else if (name.endsWith('.txt')) out.push(base + name)
    }
    return out
  }
  return {
    name: 'novel-mentions',
    resolveId(id) { if (id === V) return RESOLVED },
    async load(id) {
      if (id !== RESOLVED) return
      const { CHARACTERS } = await import('./src/cangyun-data.js')
      this.addWatchFile(DATA)
      const mentions = {}
      for (const file of listTxt(NOVEL_DIR)) {
        const full = NOVEL_DIR + file
        this.addWatchFile(full)
        const text = readFileSync(full, 'utf8')
        const counts = {}
        for (const c of CHARACTERS) {
          if (!c.name) continue
          let n = 0, at = 0, p
          while ((p = text.indexOf(c.name, at)) !== -1) { n++; at = p + c.name.length }
          if (n > 0) counts[c.id] = n
        }
        mentions[file] = counts
      }
      return `export default ${JSON.stringify(mentions)};`
    },
  }
}

// https://vite.dev/config/
// base：部署到 GitHub Pages 项目站（<user>.github.io/cangyun-wiki/）时，
// 站点在子路径下，资产须带此前缀，否则从根请求全部 404。
export default defineConfig({
  base: '/cangyun-wiki/',
  plugins: [react(), novelMentions()],
})
