/**
 * ClassTracker Google Apps Script Backend v1.5.0
 *
 * Replace all existing code with this file.
 *
 * After pasting:
 * 1. Add CLAUDE_API_KEY in Script Properties
 * 2. Deploy a new web app version
 *
 * Required sheets:
 * Students
 * Progress
 * TaughtLog
 * StandardsJudgments
 * ProgressionPlacements
 */

var API_VERSION = "1.5.0";
var ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
var CACHE_SECONDS = 300;

var SHEET_STUDENTS = "Students";
var SHEET_PROGRESS = "Progress";
var SHEET_TAUGHT = "TaughtLog";
var SHEET_JUDGMENTS = "StandardsJudgments";
var SHEET_PLACEMENTS = "ProgressionPlacements";


function doGet() {
  return jsonOutput({
    status: "ClassTracker API",
    version: API_VERSION
  });
}


function doPost(e) {
  var result;

  try {
    var data = JSON.parse(e.postData.contents || "{}");
    var action = data.action;

    if      (action === "getAll")                     result = getAll();
    else if (action === "getStudents")                result = getStudents();
    else if (action === "addStudent")                 result = addStudent(data);
    else if (action === "getProgress")                result = getProgress();
    else if (action === "saveProgress")               result = saveProgress(data);
    else if (action === "updateProgress")             result = updateProgress(data);
    else if (action === "getTaughtLog")               result = getTaughtLog();
    else if (action === "saveTaughtLog")              result = saveTaughtLog(data);
    else if (action === "getStandardsJudgments")      result = getStandardsJudgments();
    else if (action === "saveStandardsJudgment")      result = saveStandardsJudgment(data);
    else if (action === "updateStandardsJudgment")    result = updateStandardsJudgment(data);
    else if (action === "getProgressionPlacements")   result = getProgressionPlacements();
    else if (action === "saveProgressionPlacement")   result = saveProgressionPlacement(data);
    else if (action === "updateProgressionPlacement") result = updateProgressionPlacement(data);
    else if (action === "getTaughtICs")               result = getTaughtICs();
    else if (action === "saveTaughtIC")               result = saveTaughtIC(data);
    else if (action === "saveTaughtICs")              result = saveTaughtICs(data);
    else if (action === "updateTaughtIC")             result = updateTaughtIC(data);
    else if (action === "loadStubICs")                result = loadStubICs();
    else if (action === "saveStubIC")                 result = saveStubIC(data);
    else if (action === "promoteStubIC")              result = promoteStubIC(data);
    else if (action === "deleteStubIC")               result = deleteStubIC(data);
    else if (action === "claudeSuggest")              result = claudeSuggest(data);
    else if (action === "driveBackupSave")            result = driveBackupSave(data);
    else if (action === "driveBackupLoad")            result = driveBackupLoad();
    else result = { error: "Unknown action: " + action };


  } catch (err) {
    Logger.log("doPost error: " + err.toString());
    result = { error: "Server error" };
  }

  return jsonOutput(result);
}

function getTaughtICs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TaughtICs');
  if (!sheet) return [];
  return sheet.getDataRange().getValues();
}

function saveTaughtIC(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TaughtICs');
  if (!sheet) return { success: false, error: 'TaughtICs sheet not found' };
  const id = Utilities.getUuid();
  sheet.appendRow([id, data.date, data.student_id, data.ic_id, data.status, data.notes || '']);
  return { success: true, id };
}

function saveTaughtICs(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TaughtICs');
  if (!sheet) return { success: false, error: 'TaughtICs sheet not found' };
  const ids = [];
  const rows = (data.entries || []).map(entry => {
    const id = Utilities.getUuid();
    ids.push(id);
    return [id, entry.date, entry.student_id, entry.ic_id, entry.status, entry.notes || '', entry.lessonId || ''];
  });
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
  }
  return { success: true, ids };
}

function updateTaughtIC(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TaughtICs');
  if (!sheet) return { success: false, error: 'TaughtICs sheet not found' };
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      sheet.getRange(i + 1, 5).setValue(data.status);
      sheet.getRange(i + 1, 6).setValue(data.notes || '');
      return { success: true };
    }
  }
  return { success: false, error: 'Record not found' };
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


function getClaudeKey() {
  var key = PropertiesService
    .getScriptProperties()
    .getProperty("CLAUDE_API_KEY");

  if (!key) {
    throw new Error("Claude API key not configured");
  }

  return key;
}


function getCacheKey() {
  return "classTracker_getAll_" + API_VERSION;
}


function clearAllCache() {
  CacheService.getScriptCache().remove(getCacheKey());
}


function getCachedAllData() {
  var cache = CacheService.getScriptCache();
  var key = getCacheKey();
  var cached = cache.get(key);

  if (cached) {
    return JSON.parse(cached);
  }

  var data = {
    students: getStudents(),
    progress: getProgress(),
    taughtLog: getTaughtLog(),
    standardsJudgments: getStandardsJudgments(),
    progressionPlacements: getProgressionPlacements(),
    taughtICs: getTaughtICs(),
  };

  cache.put(key, JSON.stringify(data), CACHE_SECONDS);

  return data;
}


function getAll() {
  return {
    students: getStudents(),
    progress: getProgress(),
    taughtLog: getTaughtLog(),
    standardsJudgments: getStandardsJudgments(),
    progressionPlacements: getProgressionPlacements(),
    taughtICs: getTaughtICs(),
  };
}


function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}


function getSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);

    var headersMap = {
      Students: [
        "id",
        "first_name",
        "last_name",
        "year_level",
        "date_added"
      ],
      Progress: [
        "id",
        "student_id",
        "code",
        "mastery",
        "date",
        "notes",
        "evidence"
      ],
      TaughtLog: [
        "id",
        "date",
        "student_id",
        "code",
        "notes"
      ],
      StandardsJudgments: [
        "id",
        "student_id",
        "standard_id",
        "judgment",
        "locked",
        "date",
        "notes",
        "period"
      ],
      ProgressionPlacements: [
        "id",
        "student_id",
        "element",
        "sub_element",
        "level",
        "date",
        "notes",
        "ext_label",
        "ext_value"
      ]
    };

    if (headersMap[name]) {
      sheet.appendRow(headersMap[name]);
    }
  }

  return sheet;
}


function getDataRows(sheetName) {
  return getSheet(sheetName).getDataRange().getValues();
}


function getStudents() {
  return getDataRows(SHEET_STUDENTS);
}


function getProgress() {
  return getDataRows(SHEET_PROGRESS);
}


function getTaughtLog() {
  return getDataRows(SHEET_TAUGHT);
}


function getStandardsJudgments() {
  return getDataRows(SHEET_JUDGMENTS);
}


function getProgressionPlacements() {
  return getDataRows(SHEET_PLACEMENTS);
}


function addStudent(data) {
  var id = Utilities.getUuid();

  getSheet(SHEET_STUDENTS).appendRow([
    id,
    data.first_name || "",
    data.last_name || "",
    data.year_level || "",
    new Date().toISOString()
  ]);

  clearAllCache();

  return {
    success: true,
    student_id: id
  };
}


function saveProgress(data) {
  var id = Utilities.getUuid();

  getSheet(SHEET_PROGRESS).appendRow([
    id,
    data.student_id || "",
    data.content_descriptor_code || data.code || "",
    data.mastery_level || data.mastery || "",
    data.date_assessed || data.date || "",
    data.teacher_notes || data.notes || "",
    data.evidence || ""
  ]);

  clearAllCache();

  return {
    success: true,
    progress_id: id
  };
}


function updateProgress(data) {
  var sheet = getSheet(SHEET_PROGRESS);
  var values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return { error: "No progress records found" };
  }

  var headers = values[0];
  var idCol = headers.indexOf("id");
  if (idCol === -1) {
    return { error: "Progress sheet missing id column" };
  }

  var codeCol = headers.indexOf("content_descriptor_code");
  var masteryCol = headers.indexOf("mastery_level");
  var dateCol = headers.indexOf("date_assessed");
  var notesCol = headers.indexOf("teacher_notes");
  var evidenceCol = headers.indexOf("evidence_link");

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(data.progress_id || data.id)) {

      if (codeCol > -1) {
        if (data.hasOwnProperty('content_descriptor_code')) {
          sheet.getRange(r + 1, codeCol + 1).setValue(data.content_descriptor_code);
        } else if (data.hasOwnProperty('code')) {
          sheet.getRange(r + 1, codeCol + 1).setValue(data.code);
        }
      }

      if (masteryCol > -1) {
        if (data.hasOwnProperty('mastery_level')) {
          sheet.getRange(r + 1, masteryCol + 1).setValue(data.mastery_level);
        } else if (data.hasOwnProperty('mastery')) {
          sheet.getRange(r + 1, masteryCol + 1).setValue(data.mastery);
        }
      }

      if (dateCol > -1) {
        if (data.hasOwnProperty('date_assessed')) {
          sheet.getRange(r + 1, dateCol + 1).setValue(data.date_assessed);
        } else if (data.hasOwnProperty('date')) {
          sheet.getRange(r + 1, dateCol + 1).setValue(data.date);
        }
      }

      if (notesCol > -1) {
        if (data.hasOwnProperty('teacher_notes')) {
          sheet.getRange(r + 1, notesCol + 1).setValue(data.teacher_notes);
        } else if (data.hasOwnProperty('notes')) {
          sheet.getRange(r + 1, notesCol + 1).setValue(data.notes);
        }
      }

      if (evidenceCol > -1 && data.hasOwnProperty('evidence')) {
        sheet.getRange(r + 1, evidenceCol + 1).setValue(data.evidence);
      }

      clearAllCache();
      return { success: true, debug: "MARKER-V2-CHECK" };
    }
  }

  return { error: "Progress record not found" };
}


function saveTaughtLog(data) {
  var sheet = getSheet(SHEET_TAUGHT);
  var entries = data.entries || null;

  if (entries && entries.length) {
    var ids = [];
    var rows = entries.map(function(entry) {
      var id = Utilities.getUuid();
      ids.push(id);
      return [id, entry.date || '', entry.student_id || '', entry.code || '', entry.notes || '', entry.lessonId || ''];
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
    clearAllCache();
    return { success: true, ids: ids };
  }

  var id = Utilities.getUuid();
  sheet.appendRow([id, data.date || '', data.student_id || '', data.code || '', data.notes || '', data.lessonId || '']);
  clearAllCache();
  return { success: true, ids: [id], taught_log_id: id };
}


function saveStandardsJudgment(data) {
  var id = Utilities.getUuid();

  getSheet(SHEET_JUDGMENTS).appendRow([
    id,
    data.student_id || "",
    data.standard_id || "",
    data.judgment || "",
    data.locked === true ? true : false,
    data.date || new Date().toISOString(),
    data.notes || "",
    data.period || ""
  ]);

  clearAllCache();

  return {
    success: true,
    standards_judgment_id: id
  };
}


function updateStandardsJudgment(data) {
  var sheet = getSheet(SHEET_JUDGMENTS);
  var values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return { error: "No standards judgment records found" };
  }

  var headers = values[0];
  var idCol = headers.indexOf("id");
  if (idCol === -1) {
    return { error: "StandardsJudgments sheet missing id column" };
  }

  var judgmentCol = headers.indexOf("judgment");
  var lockedCol = headers.indexOf("locked");
  var dateCol = headers.indexOf("date");
  var notesCol = headers.indexOf("notes");
  var periodCol = headers.indexOf("period");

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(data.id)) {
      if (judgmentCol > -1) sheet.getRange(r + 1, judgmentCol + 1).setValue(data.judgment || values[r][judgmentCol]);
      if (lockedCol > -1) sheet.getRange(r + 1, lockedCol + 1).setValue(data.locked === true ? true : (data.locked === false ? false : values[r][lockedCol]));
      if (dateCol > -1) sheet.getRange(r + 1, dateCol + 1).setValue(data.date || values[r][dateCol]);
      if (notesCol > -1) sheet.getRange(r + 1, notesCol + 1).setValue(data.notes || values[r][notesCol]);
      if (periodCol > -1) sheet.getRange(r + 1, periodCol + 1).setValue(data.period || values[r][periodCol]);

      clearAllCache();
      return { success: true };
    }
  }

  return { error: "Standards judgment record not found" };
}


function saveProgressionPlacement(data) {
  var id = Utilities.getUuid();

  getSheet(SHEET_PLACEMENTS).appendRow([
    id,
    data.student_id || "",
    data.element || "",
    data.sub_element || "",
    data.level || "",
    data.date || new Date().toISOString(),
    data.notes || "",
    data.ext_label || "",
    data.ext_value || ""
  ]);

  clearAllCache();

  return {
    success: true,
    progression_placement_id: id
  };
}


function updateProgressionPlacement(data) {
  var sheet = getSheet(SHEET_PLACEMENTS);
  var values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return { error: "No progression placement records found" };
  }

  var headers = values[0];
  var idCol = headers.indexOf("id");
  if (idCol === -1) {
    return { error: "ProgressionPlacements sheet missing id column" };
  }

  var elementCol = headers.indexOf("element");
  var subElementCol = headers.indexOf("sub_element");
  var levelCol = headers.indexOf("level");
  var dateCol = headers.indexOf("date");
  var notesCol = headers.indexOf("notes");
  var extLabelCol = headers.indexOf("ext_label");
  var extValueCol = headers.indexOf("ext_value");

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(data.id)) {
      if (elementCol > -1) sheet.getRange(r + 1, elementCol + 1).setValue(data.element || values[r][elementCol]);
      if (subElementCol > -1) sheet.getRange(r + 1, subElementCol + 1).setValue(data.sub_element || values[r][subElementCol]);
      if (levelCol > -1) sheet.getRange(r + 1, levelCol + 1).setValue(data.level || values[r][levelCol]);
      if (dateCol > -1) sheet.getRange(r + 1, dateCol + 1).setValue(data.date || values[r][dateCol]);
      if (notesCol > -1) sheet.getRange(r + 1, notesCol + 1).setValue(data.notes || values[r][notesCol]);
      if (extLabelCol > -1) sheet.getRange(r + 1, extLabelCol + 1).setValue(data.ext_label || values[r][extLabelCol]);
      if (extValueCol > -1) sheet.getRange(r + 1, extValueCol + 1).setValue(data.ext_value || values[r][extValueCol]);

      clearAllCache();
      return { success: true };
    }
  }

  return { error: "Progression placement record not found" };
}


function claudeSuggest(data) {
  try {
    var apiKey = getClaudeKey();
    var prompt = data.prompt || "";

    if (!prompt) {
      return { error: "No prompt provided" };
    }

    var payload = {
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    };

    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    var status = response.getResponseCode();
    var body = response.getContentText();

    if (status !== 200) {
      Logger.log("Claude API error status: " + status);
      Logger.log("Claude API response: " + body);
      return { error: "AI service unavailable" };
    }

    var result = JSON.parse(body);

    if (!result.content || !result.content.length || !result.content[0].text) {
      return { error: "No response from AI" };
    }

    return {
      text: result.content[0].text
    };

  } catch (err) {
    Logger.log("Claude Suggest Error: " + err.toString());
    return { error: "AI processing failed" };
  }
}

function testClaudeAPI() {
  var apiKey = getClaudeKey();
  var payload = {
    model: ANTHROPIC_MODEL,
    max_tokens: 100,
    messages: [{ role: "user", content: "Say hello" }]
  };
  var options = {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
  Logger.log("Status: " + response.getResponseCode());
  Logger.log("Body: " + response.getContentText());
}


function loadStubICs() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('StubICs');
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return { stubs: [] };
    const stubs = rows.slice(1).map(row => ({
      icId: row[0], ownerTier: row[1], icReadinessStatus: row[2],
      homeDescriptorId: row[3], name: row[4], note: row[5], createdAt: row[6]
    }));
    return { stubs };
  } catch(e) {
    return { stubs: [], error: e.message };
  }
}

function saveStubIC(data) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('StubICs');
    sheet.appendRow([
      data.icId, data.ownerTier, data.icReadinessStatus,
      data.homeDescriptorId, data.name, data.note, data.createdAt
    ]);
    return { success: true, icId: data.icId };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function promoteStubIC(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('StubICs');
  if (!sheet) return { success: false, error: 'StubICs sheet not found' };
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.icId) {
      sheet.getRange(i + 1, 2).setValue('teacher_original');
      sheet.getRange(i + 1, 3).setValue('active');
      sheet.getRange(i + 1, 5).setValue(data.name);
      return { success: true };
    }
  }
  return { success: false, error: 'Stub IC not found' };
}

function deleteStubIC(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('StubICs');
  if (!sheet) return { success: false, error: 'StubICs sheet not found' };
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.icId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Stub IC not found' };
}

function testGetAll() {
  try {
    const result = getCachedAllData();
    Logger.log('Success. Keys: ' + Object.keys(result).join(', '));
  } catch(e) {
    Logger.log('Error: ' + e.toString());
  }
}

function testGetAllParts() {
  try {
    Logger.log('students: ' + getStudents().length);
    Logger.log('progress: ' + getProgress().length);
    Logger.log('taughtLog: ' + getTaughtLog().length);
    Logger.log('judgments: ' + getStandardsJudgments().length);
    Logger.log('placements: ' + getProgressionPlacements().length);
    Logger.log('taughtICs: ' + getTaughtICs().length);
  } catch(e) {
    Logger.log('Error: ' + e.toString());
  }
}