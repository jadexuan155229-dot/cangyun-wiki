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

/* 粗指針偵測：觸屏無懸停，凡「懸停方見」之信息須另闢點選之途。
   隨設備接駁而變（平板外接滑鼠、二合一翻轉），故監聽而非只取初值 */
export function useCoarsePointer() {
  const q = "(pointer: coarse)";
  const [coarse, setCoarse] = useState(
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(q).matches : false
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(q);
    const onC = (e) => setCoarse(e.matches);
    mq.addEventListener("change", onC);
    return () => mq.removeEventListener("change", onC);
  }, []);
  return coarse;
}
