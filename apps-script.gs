// ============================================================
//  Cha Bong Gradatouille – Email Reminder Apps Script
//  Paste toàn bộ file này vào script.google.com
// ============================================================

// ── CONFIG ──────────────────────────────────────────────────
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1xAZL_KeezDZegMcweeODDLXbYS2YT9u9OgnoEvvBmGA/edit';
const SHEET_NAME      = 'Guests';

const EVENT_START     = '20260413T070000'; // 7:00 AM, Asia/Ho_Chi_Minh
const EVENT_END       = '20260413T120000'; // ước tính kết thúc 12:00
const EVENT_TITLE     = 'Cha Bong Gradatouille 🙂‍↔️';
const EVENT_LOCATION  = 'RMIT SGS campus - sport hall';
const EVENT_DESCRIPTION =
  "Cha Bong gradatouille is tomorrow!\\n" +
  "Time: 13/4/2026 - 7am (crazy, me know)\\n" +
  "Location: RMIT SGS campus - sport hall";

const SENDER_NAME   = 'Cha Bong Gradatouille';
const EMAIL_SUBJECT = "Cha Bong gradatouille reminder";

// ── Helper ──────────────────────────────────────────────────
function getSheet() {
  const ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 1. Nhận email từ website ────────────────────────────────
function doPost(e) {
  try {
    const data  = JSON.parse(e.postData.contents);
    const name  = data.name  || '(unknown)';
    const email = data.email || '';

    if (!email) return jsonResponse({ status: 'error', message: 'No email' });

    const sheet = getSheet();

    // Tạo header nếu sheet còn trống
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Name', 'Email', 'Reminder Sent']);
    }

    // Chống duplicate
    const existingEmails = sheet.getRange(2, 3, Math.max(sheet.getLastRow() - 1, 1), 1).getValues().flat();
    if (existingEmails.includes(email)) {
      return jsonResponse({ status: 'ok', message: 'Already registered' });
    }

    sheet.appendRow([new Date(), name, email, false]);
    return jsonResponse({ status: 'ok', message: 'Registered' });

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ── 2. Tạo file .ics ────────────────────────────────────────
function createICS() {
  const uid = Utilities.getUuid() + '@chabonggradatouille';
  const now = Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'");

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cha Bong Gradatouille//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Asia/Ho_Chi_Minh:${EVENT_START}`,
    `DTEND;TZID=Asia/Ho_Chi_Minh:${EVENT_END}`,
    `SUMMARY:${EVENT_TITLE}`,
    `LOCATION:${EVENT_LOCATION}`,
    `DESCRIPTION:${EVENT_DESCRIPTION}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

// ── 3. Gửi email reminder ────────────────────────────────────
//  Trigger tự động gọi vào 12/4 lúc 9h sáng
//  Hoặc chạy thủ công để test
function sendReminders() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('No guests registered'); return; }

  const rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const icsBlob = Utilities.newBlob(createICS(), 'text/calendar', 'graduation-invite.ics');

  let sentCount = 0;

  rows.forEach((row, i) => {
    const [timestamp, name, email, alreadySent] = row;
    if (!email || alreadySent) return;

    try {
      const firstName = name.split(' ').pop() || 'friend';

      const htmlBody = `
        <html><head><meta charset="UTF-8"></head><body>
        <div style="font-family: sans-serif; max-width: 520px; margin: auto; color: #1a1a1a;">

          <div style="padding: 28px 20px 8px; line-height: 1.8;">
            <p>Hi <strong>${firstName}</strong>,</p>
            <p>
              <strong>Cha Bong gradatouille</strong> is tomorrow!
            </p>
            <p>
              <strong>Time:</strong> 13/4/2026 - 7am (crazy, me know)<br>
              <strong>Location:</strong> RMIT SGS campus - sport hall
            </p>
          </div>

          <img src="https://chabonggradatouille.vercel.app/assets/images/email-img.jpeg"
               alt="Cha Bong Gradatouille"
               width="100%"
               style="display:block; width:100%; border-radius: 0 0 12px 12px; margin-top: 8px;">

        </div>
        </body></html>
      `;

      GmailApp.sendEmail(email, EMAIL_SUBJECT, '', {
        htmlBody,
        name: SENDER_NAME,
        attachments: [icsBlob.copyBlob()]
      });

      sheet.getRange(i + 2, 4).setValue(true);
      sentCount++;
      Logger.log(`Sent to: ${email}`);

    } catch (err) {
      Logger.log(`Failed for ${email}: ${err}`);
    }
  });

  Logger.log(`Done. Sent ${sentCount} reminder(s).`);
}

// ── 4. Setup time-based trigger (chạy 1 lần sau khi deploy) ─
function createTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendReminders')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('sendReminders')
    .timeBased()
    .atDate(2026, 4, 12)
    .atHour(9)
    .create();

  Logger.log('Trigger created: sendReminders → Apr 12, 2026 at 9:00');
}

// ── 5. Test: thêm email test vào sheet ──────────────────────
//  Chạy hàm này trước để kiểm tra luồng hoạt động
function addTestGuest() {
  const sheet = getSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Name', 'Email', 'Reminder Sent']);
  }
  sheet.appendRow([new Date(), 'Tri Pham', 'phamhuutri108@gmail.com', false]);
  Logger.log('Test guest added.');
}
