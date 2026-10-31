// Subscribable feed for the financial calendar, written by the build to dist/magazine/financial-calendar.ics.
// Calendar apps re-read this address on their own, so editing a reminder here reaches every subscriber.

const PAGE = 'https://romanoinvest.co.il/magazine/financial-calendar';

// [month, day, title, text]; each reminder repeats every year and links to its month on the page
export const REMINDERS = [
  [1, 5, 'קופת גמל להשקעה: תקרה חדשה לשנה', 'להחליט על הפקדה חד־פעמית או הוראת קבע, לפי התזרים והמטרות.'],
  [3, 25, 'לבדוק שהגיעו טופס 106 וטופס 867', 'טופס 106 מכל מעסיק עד 31.3, וטופס 867 מכל בנק ובית השקעות.'],
  [4, 20, 'לקרוא את הדוחות השנתיים מהקרנות', 'דמי ניהול, מסלול השקעה וכיסויים ביטוחיים, בכל דוח.'],
  [9, 1, 'לעדכן מוטבים בקרנות ובביטוחים', 'נישואים, גירושים או לידה לא מעדכנים את המוטבים מעצמם.'],
  [11, 15, 'לחשב כמה עוד להפקיד השנה', 'עצמאים: הפקדות לפנסיה ולקרן ההשתלמות לפני סוף שנת המס.'],
  [12, 15, 'הפקדות ותרומות של סוף השנה', 'פנסיה וקרן השתלמות, ניצול תקרת קופת הגמל להשקעה ותרומות. הכול צריך להיקלט עד 31.12.'],
];

const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
// calendar lines are limited to 75 bytes; Hebrew letters take two, so fold by bytes, never inside a letter
const fold = (line) => {
  const parts = [];
  let part = '';
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    if (bytes + size > (parts.length ? 74 : 75)) { parts.push(part); part = ''; bytes = 0; }
    part += ch;
    bytes += size;
  }
  parts.push(part);
  return parts.join('\r\n ');
};

export const calendarFeed = () => {
  const events = REMINDERS.map(([mo, d, title, text], i) => {
    const after = new Date(Date.UTC(2026, mo - 1, d + 1));
    const link = `${PAGE}?from=reminder#m${mo}`;
    return [
      'BEGIN:VEVENT',
      `UID:rr-calendar-${i + 1}@romanoinvest.co.il`,
      'DTSTAMP:20261031T000000Z',
      `DTSTART;VALUE=DATE:2026${pad(mo)}${pad(d)}`,
      `DTEND;VALUE=DATE:${after.getUTCFullYear()}${pad(after.getUTCMonth() + 1)}${pad(after.getUTCDate())}`,
      'RRULE:FREQ=YEARLY',
      `SUMMARY:${esc(title)}`,
      `DESCRIPTION:${esc(`${text}\nהפירוט בלוח השנה הפיננסי: ${link}`)}`,
      `URL:${link}`,
      'TRANSP:TRANSPARENT',
      // 9:00 on the day; some apps drop alerts from subscribed calendars and use their own defaults
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'TRIGGER:PT9H', 'END:VALARM',
      'END:VEVENT',
    ];
  });
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Roei Romano//Financial calendar//HE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc('לוח השנה הפיננסי · רועי רומנו')}`,
    `X-WR-CALDESC:${esc('תזכורות שנתיות לחיסכון, לפנסיה ולמס. מתעדכן מעצמו.')}`,
    'X-WR-TIMEZONE:Asia/Jerusalem',
    'REFRESH-INTERVAL;VALUE=DURATION:P1D', 'X-PUBLISHED-TTL:P1D',
    ...events.flat(),
    'END:VCALENDAR',
  ].map(fold).join('\r\n') + '\r\n';
};
