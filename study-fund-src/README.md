# בדיקת קרן השתלמות לעצמאים: המקור

הקוד של הבדיקה בכתובת /study-fund. הוא הועבר מ־github.com/romanoroei/KerenHeshtalmut (consumer) ב־14.11.2026.
הדף עצמו: business-site/study-fund.html, העיצוב: business-site/css/study-fund.css.

הדפדפן טוען קובץ אחד, business-site/js/study-fund.js, שנבנה מהתיקייה הזו. אחרי כל שינוי כאן:

    esbuild study-fund-src/main.js --bundle --format=iife --target=es2018 --outfile=business-site/js/study-fund.js

(esbuild קיים בתיקיית node_modules של פרויקט KerenHeshtalmut.)

עדכון שנתי: data/tax-data.js. להוסיף את נתוני השנה החדשה ל־TAX_DATA_BY_YEAR. עד אז הבדיקה מציגה הודעה שהחישוב לפי השנה הקודמת.
אין בבדיקה Google Analytics. analytics/tracking.js שולח רק תוויות קבועות ל־/api/count (study:start, study:done, study:whatsapp, study:share).
