import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base：部署到 GitHub Pages 项目站（<user>.github.io/cangyun-wiki/）时，
// 站点在子路径下，资产须带此前缀，否则从根请求全部 404。
export default defineConfig({
  base: '/cangyun-wiki/',
  plugins: [react()],
})
