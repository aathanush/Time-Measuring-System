function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Screentime");

    // Create sheet with headers if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet("Screentime");
      const header = sheet.getRange(1, 1, 1, 4);
      header.setValues([["Date", "Phone (min)", "Laptop (min)", "Total (min)"]]);
      header.setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    const data    = JSON.parse(e.postData.contents);
    const date    = data.date;       // "2026-05-26"
    const source  = data.source;     // "phone" or "laptop"
    const minutes = Number(data.minutes);

    // Check if a row for today already exists
    const values  = sheet.getDataRange().getValues();
    let rowIndex  = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === date) { rowIndex = i + 1; break; }
    }

    if (rowIndex === -1) {
      // No row for today yet — append a new one
      const phoneVal  = source === "phone"  ? minutes : "";
      const laptopVal = source === "laptop" ? minutes : "";
      sheet.appendRow([date, phoneVal, laptopVal, minutes]);
    } else {
      // Row exists — update the right column
      const col = source === "phone" ? 2 : 3;
      sheet.getRange(rowIndex, col).setValue(minutes);
      // Recalculate total
      const p = Number(sheet.getRange(rowIndex, 2).getValue()) || 0;
      const l = Number(sheet.getRange(rowIndex, 3).getValue()) || 0;
      sheet.getRange(rowIndex, 4).setValue(p + l);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Health check — visit the URL in browser to confirm it's live
function doGet() {
  return ContentService
    .createTextOutput("Screentime tracker is running!")
    .setMimeType(ContentService.MimeType.TEXT);
}
