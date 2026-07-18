import { useState, useEffect } from "react";

/* 全站視覺常量：宋體字族與底色板，自 cangyun-wiki 抽出以供諸視圖共用 */
export const serif = '"Songti SC","Noto Serif SC","Noto Serif CJK SC","SimSun",serif';
export const T = {
  bg: "#15181D", panel: "#1D2229", panelHi: "#232A33", line: "#2E3640",
  ink: "#E7E2D6", muted: "#8B94A0", faint: "#5B6470",
  accent: "#B5442D", /* 全站高亮：橘红 */
  seal: "#A13B4B",   /* 品評印章：復古胭脂紅，別於高亮橘紅與天策暗紅 */
};

/* 窄屏偵測：僅視圖層響應式之用，不涉數據 */
export function useNarrow(bp = 780) {
  const [narrow, setNarrow] = useState(typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const onR = () => setNarrow(window.innerWidth < bp);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [bp]);
  return narrow;
}
