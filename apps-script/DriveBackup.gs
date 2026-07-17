/**
 * Drive Backup — safety-net JSON backup of Unit Plans + Lessons.
 *
 * Unit plans and lessons live in localStorage only (see docs/ARCHITECTURE-ASSESSMENT.md
 * §6), so a browser cache clear loses them. This adds two Apps Script actions that
 * write/read a single JSON backup file in the teacher's Google Drive, called from
 * app.js's Drive sync (search app.js for "DRIVE BACKUP SYNC"). It reuses the script's
 * own Drive access — the teacher never sees a separate Google sign-in for this.
 *
 * NOT part of the deployed Apps Script yet. This file is checked into the repo for
 * version control and review; it has to be copied into the Apps Script project behind
 * API_URL (app.js) by hand, then redeployed as the same Web App (same exec URL) —
 * this repo has no access to that separate script project.
 *
 * Wiring instructions:
 *   1. Open the Apps Script project for the deployed Web App (script.google.com).
 *   2. Add a new script file (e.g. "DriveBackup.gs") and paste everything below the
 *      dashed line into it.
 *   3. In your existing doPost(e) function, find where it reads `action` from the
 *      request and add two branches that call the functions below, e.g.:
 *
 *        if (action === 'driveBackupSave') {
 *          return jsonResponse_(driveBackupSave(data));
 *        }
 *        if (action === 'driveBackupLoad') {
 *          return jsonResponse_(driveBackupLoad());
 *        }
 *
 *      Replace `jsonResponse_` with whatever helper your doPost already uses to return
 *      a ContentService JSON response, e.g.:
 *        return ContentService.createTextOutput(JSON.stringify(result))
 *          .setMimeType(ContentService.MimeType.JSON);
 *
 *   4. Deploy > Manage deployments > edit the existing deployment > New version.
 *      The exec URL does not change, so app.js needs no changes for this step.
 *
 * Until step 4 is done, the app's Drive sync calls simply fail — the frontend already
 * handles that gracefully (see driveSyncIndicatorHtml() in app.js): it shows "Drive
 * sync failed — retry" after two failed attempts instead of breaking anything.
 * ---------------------------------------------------------------------------
 */

var DRIVE_BACKUP_FOLDER_NAME = 'ClassTracker Backups';
var DRIVE_BACKUP_FILE_NAME = 'ClassTracker_UnitPlans_Backup.json';

/**
 * data: { unitPlans: array, lessonPlans: array, savedAt: ISO string }
 * Returns { success: true, savedAt } or { error: string }.
 */
function driveBackupSave(data) {
  try {
    var folder = getOrCreateDriveBackupFolder_();
    var savedAt = (data && data.savedAt) || new Date().toISOString();
    var payload = JSON.stringify({
      unitPlans: (data && data.unitPlans) || [],
      lessonPlans: (data && data.lessonPlans) || [],
      savedAt: savedAt,
    });

    var files = folder.getFilesByName(DRIVE_BACKUP_FILE_NAME);
    if (files.hasNext()) {
      files.next().setContent(payload);
    } else {
      folder.createFile(DRIVE_BACKUP_FILE_NAME, payload, MimeType.PLAIN_TEXT);
    }
    return { success: true, savedAt: savedAt };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Returns { success: true, data: {unitPlans, lessonPlans, savedAt} | null }
 * or { error: string }. data is null when no backup has been written yet.
 */
function driveBackupLoad() {
  try {
    var folder = getOrCreateDriveBackupFolder_();
    var files = folder.getFilesByName(DRIVE_BACKUP_FILE_NAME);
    if (!files.hasNext()) return { success: true, data: null };
    var file = files.next();
    var data = JSON.parse(file.getBlob().getDataAsString());
    return { success: true, data: data };
  } catch (err) {
    return { error: String(err) };
  }
}

function getOrCreateDriveBackupFolder_() {
  var folders = DriveApp.getFoldersByName(DRIVE_BACKUP_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_BACKUP_FOLDER_NAME);
}
