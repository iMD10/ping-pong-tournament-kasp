// One file, plain arrays, bilingual. Muhannad appends lines here whenever he
// remembers one, no code changes needed elsewhere. See SPEC.md §7.4.

export const kleejaLines: { ar: string; en: string }[] = [
  { ar: "لقيت كليجا! يا حظك.", en: "Found a kleeja! Delicious." },
  { ar: "اللي يفوز يكمل، واللي يخسر الله يعوضه.", en: "The winner goes on, the loser gets consoled." },
  { ar: "كلمة المرور غلط يا عم.", en: "Wrong password, champ." },
  { ar: "ودّع البطولة.", en: "Say goodbye to the tournament." },
  { ar: "يا بعدي.", en: "Oh dear." },
];

export const emptyStateLines: { ar: string; en: string }[] = [
  { ar: "ما به شي هنا.", en: "Nothing here... yet." },
  { ar: "فاضي مثل جدول اللي طلع من الدور الأول.", en: "Empty like the schedule of whoever lost round 1." },
];

export const subtitleLines: { ar: string; en: string }[] = [
  { ar: "كرتون كليجا ينتظر بطل واحد فقط.", en: "One box of kleeja. One champion." },
  { ar: "إذا كان خصمك القاضي فمن تقاضي؟", en: "If your opponent is the judge, who do you appeal to?" },
];

export function randomLine(pool: { ar: string; en: string }[]): { ar: string; en: string } {
  return pool[Math.floor(Math.random() * pool.length)];
}
