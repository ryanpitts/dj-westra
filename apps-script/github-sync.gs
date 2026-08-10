/**
 * Exports the active sheet to CSV and commits it to GitHub.
 *
 * Setup (one-time):
 * 1. In this Apps Script project, run `setGithubToken` once from the editor
 *    (Run > setGithubToken) after pasting your token below, then delete the
 *    pasted token from the source so it isn't left in plain text. The token
 *    needs `repo` scope (or fine-grained "Contents: read and write" access
 *    to this repo). Create one at https://github.com/settings/tokens
 * 2. Reload the spreadsheet. A "GitHub Sync" menu will appear.
 * 3. Use "GitHub Sync > Export to GitHub" whenever you want to push the
 *    current sheet's contents to data/shows.csv. The sheet's header row
 *    must match: show_date, show_time, venue, venue_url, notes,
 *    playlist_url, show_image.
 */

var GITHUB_OWNER = 'ryanpitts';
var GITHUB_REPO = 'dj-westra';
var GITHUB_BRANCH = 'main';
var GITHUB_PATH = 'data/shows.csv';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GitHub Sync')
    .addItem('Export to GitHub', 'exportSheetToGithub')
    .addToUi();
}

/** Run this once manually to store your token, then remove the literal below. */
function setGithubToken() {
  var token = 'paste-your-token-here';
  PropertiesService.getScriptProperties().setProperty('GITHUB_TOKEN', token);
}

function exportSheetToGithub() {
  var ui = SpreadsheetApp.getUi();
  try {
    var csv = sheetToCsv(SpreadsheetApp.getActiveSheet());
    commitToGithub(csv);
    ui.alert('Exported to GitHub', GITHUB_PATH + ' was pushed to ' + GITHUB_OWNER + '/' + GITHUB_REPO + '@' + GITHUB_BRANCH + '.', ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Export failed', String(err), ui.ButtonSet.OK);
  }
}

function sheetToCsv(sheet) {
  var timeZone = sheet.getParent().getSpreadsheetTimeZone();
  var values = sheet.getDataRange().getValues();
  return values.map(function (row) {
    return row.map(function (value) {
      return csvEscape(formatCellValue(value, timeZone));
    }).join(',');
  }).join('\n') + '\n';
}

function formatCellValue(value, timeZone) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, timeZone, 'yyyy-MM-dd');
  }
  return value;
}

function csvEscape(value) {
  var text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) {
    text = '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function commitToGithub(csvContent) {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    throw new Error('No GitHub token found. Run setGithubToken() first.');
  }

  var apiUrl = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + GITHUB_PATH;
  var headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json'
  };

  var sha = null;
  var getResponse = UrlFetchApp.fetch(apiUrl + '?ref=' + GITHUB_BRANCH, {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true
  });
  if (getResponse.getResponseCode() === 200) {
    sha = JSON.parse(getResponse.getContentText()).sha;
  } else if (getResponse.getResponseCode() !== 404) {
    throw new Error('Failed to look up existing file (HTTP ' + getResponse.getResponseCode() + '): ' + getResponse.getContentText());
  }

  var payload = {
    message: 'Update shows.csv from Google Sheet (' + new Date().toISOString() + ')',
    content: Utilities.base64Encode(csvContent, Utilities.Charset.UTF_8),
    branch: GITHUB_BRANCH
  };
  if (sha) {
    payload.sha = sha;
  }

  var putResponse = UrlFetchApp.fetch(apiUrl, {
    method: 'put',
    headers: headers,
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = putResponse.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error('GitHub commit failed (HTTP ' + code + '): ' + putResponse.getContentText());
  }
}
