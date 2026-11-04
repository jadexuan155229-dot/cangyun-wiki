// Translation overlay only: never merge into or mutate wiki-data.js.
// Unresolved readings and editorial decisions: docs/lvdingyi-translation-review.md.
// Review notes are deliberately not imported into the public profile.
export const charactersEn = {
  lvdingyi: {
    name: 'Lü Dingyi',
    zi: 'Yaoxian (爻先)',
    // An interpretive subtitle, not a translation of a verified classical quotation.
    epithet: "The Weight of a Clerk's Pen",
    birthplace: 'Fengzhou (Jiuyuan Commandery), Guannei Circuit',
    gloss: {
      passages: [
        { work: 'Book of Documents', section: '“Yi and Ji”', quote: '“The phoenixes came in stately bearing (yi 儀).”' },
        { work: 'Book of Changes', section: '“Jian”', quote: '“Top nine: the wild goose gradually advances to the land; its feathers may be used for ceremonial adornment (yi 儀).”' },
        { work: 'Original Meaning', section: 'Zhu Xi', quote: '“The top nine is at the highest point, beyond the positions of humankind.”' },
      ],
      explanation: '“Top nine” is the name of the uppermost line (yao 爻) in the outer trigram. The courtesy name joins yao 爻 with xian 先, echoing yi 儀 in his given name.',
    },
    profile: {
      官职身份: 'Former commander of the Third Regiment. Descended from the Lü clan of Jiuyuan, he shares a lineage with Lü Bu, Marquis of Wen. As a young man he worked as a clerk at Middle Shouxiang City, gaining some recognition for his handling of grain distribution at Wuyuan. In 737 he joined the Xuanjia Army as an aide to the military strategist, helping to prepare official papers, registers and reports, draft correspondence, and coordinate the accounts. He later took charge of military administration and strategy on the front line.',
      体貌特征: 'Tall and wiry, spare and resolute, with an austere, sharply defined frame. He has been prone to illness since childhood. A knee injury left him with recurring rheumatic aches and bone pain. In 746 he took a poisoned needle meant for Min Fangcheng; the lingering poison damaged his heart, leaving him subject to palpitations and tightness in the chest when tired or angered.',
      性格: 'Reserved and distant, he does not make friends easily. His calligraphy has a spare, striking elegance; his temperament is rigorous and orderly. Exacting with himself and others, he comes close to perfection in all he does. He prefers to keep his family out of public view.',
      偶像: '', // Source is blank; do not invent an influence.
      武学: 'In his early years, blocking force head-on and striking hard often cost him dearly. After his knee injury in 738, he began turning his focus inward. His technique came to favor coiling force and close, short hooks: lean but powerful, like a withered vine with a shadow hanging from it, like dead wood holding spring within. Just as his strength seems spent, a turn of the hand brings another killing stroke; the coiling pressure never lets go. His slight build and sharply unconventional technique give him a style all his own among Cangyun’s heavy, forceful shield-and-blade arts.',
      随身物件: 'A longevity-thread charm for a child.',
      喜好: 'After battle, when the troops have returned to camp, he finds an open space neither too near nor too far away and plays a reed pipe (bili). The sound is desolate and lingering, as though offering comfort, or asking after someone.',
      专擅: 'Keeping military registers, allocating provisions, and organizing grain distribution in frontier towns. He reads maps and understands battle formations, judging when to advance and when to withdraw in sand-table exercises.',
    },
  },
};
export const characterTranslation = (locale, id) => locale === 'en' ? charactersEn[id] ?? null : null;
