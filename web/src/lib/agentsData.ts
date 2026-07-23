/**
 * Agents workspace data — ported 1:1 from the Claude Design handoff
 * (`design_handoff_easy_life_crm/design_files/Agents.dc.html`, `_agentDefs` /
 * `_seed` / `_actionDefs`). Copy, structure and tint colors are verbatim from
 * the design; tints match our existing CSS tokens exactly (#0e8ba0=--color-gold,
 * #12805c=--color-success, #7c6cf0=--color-magenta-glow, #b26a00=--color-warning).
 *
 * This is client-side demo content (mock replies), matching the design spec's
 * own scope: "All data shown is realistic mock data — wire it to real APIs."
 * Real wiring = replace `respond()` with a call to the agent backend.
 */

export type AgentKey = 'whatsapp' | 'video' | 'social' | 'content';

export interface AgentDef {
  key: AgentKey;
  name: string;
  cap: string;
  status: string;
  tint: string;
}

export const AGENT_DEFS: Record<AgentKey, AgentDef> = {
  whatsapp: {
    key: 'whatsapp',
    name: 'סוכן וואטסאפ',
    cap: 'שירות, תזכורות וקמפיינים בוואטסאפ',
    status: 'פעיל · 142 שיחות היום',
    tint: '#12805c',
  },
  video: {
    key: 'video',
    name: 'סוכן יצירת וידאו',
    cap: 'סרטוני מוצר ופרסום, אוטומטית',
    status: 'פעיל · 3 סרטונים החודש',
    tint: '#7c6cf0',
  },
  social: {
    key: 'social',
    name: 'סוכן רשתות ולידים',
    cap: 'סריקת רשתות חברתיות ואיתור לידים',
    status: 'פעיל · 12 לידים חדשים',
    tint: '#0e8ba0',
  },
  content: {
    key: 'content',
    name: 'סוכן תוכן',
    cap: 'כתיבת פוסטים, מיילים וניוזלטרים',
    status: 'פעיל · 2 טיוטות מוכנות',
    tint: '#b26a00',
  },
};

export const AGENT_ORDER: AgentKey[] = ['whatsapp', 'video', 'social', 'content'];

export type MessageType = 'text' | 'approval' | 'campaign' | 'video' | 'leads';
export type MessageRole = 'agent' | 'user';

export interface LeadRow {
  emoji: string;
  tint: string;
  name: string;
  note: string;
}

export interface AgentMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  text?: string;
  body?: string;
  preview?: string;
  title?: string;
  audience?: string;
  timing?: string;
  duration?: string;
  meta?: string;
  leads?: LeadRow[];
}

let seq = 0;
const id = () => `m${++seq}`;

export function seedThreads(): Record<AgentKey, AgentMessage[]> {
  return {
    whatsapp: [
      {
        id: id(),
        role: 'agent',
        type: 'text',
        text: 'בוקר טוב ישראל 👋 אני סוכן הוואטסאפ — עונה ללקוחות 24/7, שולח תזכורות ומריץ קמפיינים. מה נעשה היום?',
      },
      {
        id: id(),
        role: 'agent',
        type: 'approval',
        body: 'לקוח (מוסך דהן) שאל אם יש מבצע החודש. ניסחתי מענה — לאשר שליחה?',
        preview: 'שלום! החודש יש 15% הנחה על טיפול תקופתי 🚗 אפשר לקבוע תור ישירות כאן. נשמח לראותך!',
      },
    ],
    video: [
      {
        id: id(),
        role: 'agent',
        type: 'text',
        text: 'היי 🎬 אני סוכן יצירת הווידאו. תן לי מוצר, מבצע או רעיון — ואחזיר סרטון מוכן לפרסום. אפשר גם לבחור פעולה מהירה למטה.',
      },
    ],
    social: [
      {
        id: id(),
        role: 'agent',
        type: 'text',
        text: 'שלום ישראל 🎯 אני סוכן הרשתות והלידים. אני סורק אינסטגרם, פייסבוק וגוגל, מאתר לידים חמים ומכין דוחות. מה לבדוק?',
      },
    ],
    content: [
      {
        id: id(),
        role: 'agent',
        type: 'text',
        text: 'היי ✍️ אני סוכן התוכן. אני כותב פוסטים, מיילים וניוזלטרים בקול של המותג שלך — ומעביר לך לאישור לפני פרסום. מה נכתוב היום?',
      },
    ],
  };
}

export interface QuickAction {
  label: string;
  respond: () => AgentMessage;
}

export function quickActionsFor(key: AgentKey): QuickAction[] {
  const mk = (type: MessageType, fields: Partial<AgentMessage>): (() => AgentMessage) => () => ({
    id: id(),
    role: 'agent',
    type,
    ...fields,
  });

  switch (key) {
    case 'whatsapp':
      return [
        {
          label: 'שלח קמפיין ללקוחות',
          respond: mk('campaign', {
            title: 'קמפיין וואטסאפ מוכן לשליחה',
            preview:
              'היי {שם}, מזמינים אותך למבצע הקיץ שלנו — 20% הנחה על כל השירותים עד סוף החודש ☀️ להזמנה מהירה השב/י כאן.',
            audience: '412 לקוחות פעילים',
            timing: 'שליחה מיידית',
          }),
        },
        {
          label: 'נסח הודעת קידום',
          respond: mk('text', {
            text: 'הנה טיוטה: ״תודה שאתם איתנו! 🎁 כלקוחות מועדפים מגיעה לכם הטבה — 15% על ההזמנה הבאה. רק להשיב ״מעוניין״.״ רוצה שאתאים את הטון או אשלח לקבוצה מסוימת?',
          }),
        },
        {
          label: 'סכם שיחות היום',
          respond: mk('text', {
            text: 'סיכום היום: 142 שיחות · 38 נענו אוטומטית · 12 לידים חדשים הועברו ל‑CRM · 4 בקשות לתור נקבעו. 2 שיחות ממתינות לתשובה שלך באינבוקס.',
          }),
        },
      ];
    case 'video':
      return [
        {
          label: 'צור סרטון מוצר',
          respond: mk('video', {
            title: 'סרטון מוצר — טיוטה',
            duration: '0:30',
            meta: 'פורמט אנכי 9:16 · מוזיקה רגועה · כתוביות בעברית',
          }),
        },
        {
          label: 'רעיון לפרסומת',
          respond: mk('text', {
            text: '3 רעיונות לפרסומת:\n1. ״לפני ואחרי״ — הדגמת התוצאה.\n2. עדות לקוח אמיתית ב‑15 שניות.\n3. טיפ מקצועי מהיר שממתג אתכם כמומחים.\nרוצה שאפיק אחד מהם לסרטון?',
          }),
        },
        {
          label: 'ריל לאינסטגרם',
          respond: mk('video', {
            title: 'ריל לאינסטגרם — טיוטה',
            duration: '0:15',
            meta: 'פורמט 9:16 · טרנד נוכחי · קריאה לפעולה בסוף',
          }),
        },
      ];
    case 'social':
      return [
        {
          label: 'מצא לידים חדשים',
          respond: mk('leads', {
            title: '3 לידים חמים אותרו',
            leads: [
              { emoji: '📸', tint: 'rgba(124,108,240,.14)', name: 'דנה — אינסטגרם', note: 'הגיבה ״מעוניינת במחיר״ לפוסט האחרון' },
              { emoji: '👍', tint: 'rgba(22,102,168,.14)', name: 'אולם ״גן ורדים״ — פייסבוק', note: 'חיפש שירות דומה באזור' },
              { emoji: '🔍', tint: 'rgba(14,139,160,.12)', name: 'רן לוי — גוגל', note: 'לחץ על מודעה, לא השאיר פרטים' },
            ],
          }),
        },
        {
          label: 'בדוק אזכורים ברשתות',
          respond: mk('text', {
            text: 'סרקתי את הרשתות ב‑24 השעות האחרונות: 3 אזכורים חיוביים של המותג, תגובה אחת שדורשת מענה (באינסטגרם), ועלייה של 18% בחשיפה. רוצה שאכין תגובה לתגובה השלילית?',
          }),
        },
        {
          label: 'דוח שבועי',
          respond: mk('text', {
            text: 'דוח שבועי מוכן 📊 חשיפה +22% · 47 לידים · 3 קמפיינים פעילים · הפוסט המוביל: ״טיפ החודש״. שלחתי גרסה מלאה לוואטסאפ שלך.',
          }),
        },
      ];
    case 'content':
      return [
        {
          label: 'כתוב פוסט',
          respond: mk('approval', {
            body: 'הכנתי פוסט לאינסטגרם על מבצע הקיץ — לאשר פרסום?',
            preview:
              '☀️ קיץ = הזמן לפנק את העסק! החודש בלבד: 20% הנחה על כל החבילות. תייגו חבר שחייב לשמוע על זה 👇 #EasyLife #עסקים',
          }),
        },
        {
          label: 'נסח ניוזלטר',
          respond: mk('text', {
            text: 'טיוטת ניוזלטר מוכנה 📧 נושא: ״3 דברים שקרו החודש בעסק שלך״. כולל: עדכון מבצע, טיפ מקצועי, וקריאה לפעולה. רוצה שאשלח לרשימת התפוצה (1,240 נמענים)?',
          }),
        },
        {
          label: 'רעיונות לתוכן שבועי',
          respond: mk('text', {
            text: 'לוח תוכן לשבוע הקרוב:\nיום א׳ — טיפ מקצועי קצר.\nיום ג׳ — עדות לקוח.\nיום ה׳ — מאחורי הקלעים.\nשבת — שאלה לקהילה.\nלהפוך אחד מהם לפוסט מוכן?',
          }),
        },
      ];
  }
}

export const PLACEHOLDER: Record<AgentKey, string> = {
  whatsapp: 'בקש מהסוכן לנסח או לשלוח הודעה…',
  video: 'תאר את הסרטון שתרצה…',
  social: 'בקש מחקר, לידים או דוח…',
  content: 'בקש פוסט, מייל או ניוזלטר…',
};

export function approveReply(type: MessageType): AgentMessage {
  const text =
    type === 'approval'
      ? 'מצוין — ההודעה נשלחה ללקוח ✓'
      : type === 'campaign'
        ? 'הקמפיין יצא לדרך 🚀 נשלח ל‑412 לקוחות. אעדכן כאן על תגובות.'
        : 'הסרטון אושר ופורסם ✓ אעקוב אחרי הצפיות ואחזור עם נתונים.';
  return { id: id(), role: 'agent', type: 'text', text };
}

export function rejectReply(type: MessageType): AgentMessage {
  const text =
    type === 'approval'
      ? 'בסדר, לא שלחתי. רוצה שאנסח מחדש?'
      : type === 'campaign'
        ? 'פתחתי לעריכה — מה לשנות בהודעה?'
        : 'מכין גרסה נוספת עם שינויים — רגע אחד…';
  return { id: id(), role: 'agent', type: 'text', text };
}

export function leadAddedReply(leadName: string): AgentMessage {
  return { id: id(), role: 'agent', type: 'text', text: `${leadName} נוסף ל‑CRM ✓ שייכתי אותו לשלב ״ליד״.` };
}

export function userMessage(text: string): AgentMessage {
  return { id: id(), role: 'user', type: 'text', text };
}

export function fallbackAck(): AgentMessage {
  return {
    id: id(),
    role: 'agent',
    type: 'text',
    text: 'קיבלתי 👍 אני מטפל בזה ואחזור אליך כאן עם תוצאה. אפשר גם לבחור פעולה מהירה מלמעלה.',
  };
}
