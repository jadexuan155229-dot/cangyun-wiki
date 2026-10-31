// UI copy only. Keys retain the original Chinese text for lossless Chinese fallback.
const en = {
  人物檔案: 'Characters', 事件年表: 'Timeline', 山河輿圖: 'Map',
  行星關係圖: 'Orbital Relations', 群像網絡: 'Character Network', 文庫: 'Library',
  卷首: 'Opening', 回到卷首: 'Return to opening',
  生卒: 'Lifespan', 出身: 'Birthplace', 事件: 'Events', 字: 'Courtesy name',
  名字訓詁: 'Name and allusions', 檔案: 'Profile',
  官职身份: 'Position & background', 体貌特征: 'Appearance & health', 性格: 'Personality',
  偶像: 'Influences', 武学: 'Martial arts', 随身物件: 'Personal possessions', 喜好: 'Interests', 专擅: 'Expertise',
  '關係（自關係庫）': 'Relationships (from the relationship database)',
  '同事人物（共見事件計數）': 'Co-occurring characters (shared event counts)',
  '繫年事件（依 年·月·序號）': 'Dated events (by year · month · sequence)',
  '見於文庫（本名計數）': 'Library appearances (name counts)',
  關閉檔案: 'Close profile', 站內導航: 'Main navigation',
  英文試驗範圍: 'English prototype: navigation and Lü Dingyi’s profile only. Other content remains in Chinese.',
};
export const translateUI = (locale, key) => locale === 'en' ? en[key] ?? key : key;
export const eventCountText = (locale, count) => locale === 'en'
  ? `${count} dated event${count === 1 ? '' : 's'}` : `繫年 ${count} 事`;
export const libraryCountText = (locale, count, kind) => locale === 'en'
  ? `${count} ${kind === 'chapters' ? (count === 1 ? 'chapter' : 'chapters') : (count === 1 ? 'mention' : 'mentions')}`
  : `${count} ${kind === 'chapters' ? '章' : '处'}`;
