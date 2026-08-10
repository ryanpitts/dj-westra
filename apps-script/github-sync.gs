/**
 * Exports the active sheet to JSON and commits it to GitHub.
 *
 * Setup (one-time):
 * 1. In this Apps Script project, run `setGithubToken` once from the editor
 *    (Run > setGithubToken) after pasting your token below, then delete the
 *    pasted token from the source so it isn't left in plain text. The token
 *    needs `repo` scope (or fine-grained "Contents: read and write" access
 *    to this repo). Create one at https://github.com/settings/tokens
 * 2. Reload the spreadsheet. A "GitHub Sync" menu will appear.
 * 3. Use "GitHub Sync > Export to GitHub" whenever you want to push the
 *    current sheet's contents to GitHub as data/<sheet-name>.json (e.g. a
 *    sheet named "Shows" is pushed to data/shows.json, as an array of
 *    objects keyed by the header row). The sheet's header row must match:
 *    show_date, show_time, venue, venue_url, notes, playlist_url,
 *    show_image.
 * 4. Use "GitHub Sync > Fill in missing artwork" to look up artwork for any
 *    row that has a playlist_url but no show_image, and write it into the
 *    sheet. Run this before exporting if you've added new playlist links.
 */

var GITHUB_OWNER = 'ryanpitts';
var GITHUB_REPO = 'dj-westra';
var GITHUB_BRANCH = 'main';
var GITHUB_DATA_DIR = 'data';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GitHub Sync')
    .addItem('Export to GitHub', 'exportSheetToGithub')
    .addItem('Fill in missing artwork', 'fillMissingArtwork')
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
    var sheet = SpreadsheetApp.getActiveSheet();
    var path = githubPathForSheet(sheet);
    var json = sheetToJson(sheet);
    commitToGithub(path, json);
    ui.alert('Exported to GitHub', path + ' was pushed to ' + GITHUB_OWNER + '/' + GITHUB_REPO + '@' + GITHUB_BRANCH + '.', ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Export failed', String(err), ui.ButtonSet.OK);
  }
}

/** Turns a sheet name like "Shows" into data/shows.json. */
function githubPathForSheet(sheet) {
  var slug = sheet.getName()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return GITHUB_DATA_DIR + '/' + slug + '.json';
}

function fillMissingArtwork() {
  var ui = SpreadsheetApp.getUi();
  try {
    var count = fillMissingArtworkForSheet(SpreadsheetApp.getActiveSheet());
    ui.alert('Artwork updated', count + ' row(s) updated with artwork from Apple Music.', ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Artwork fetch failed', String(err), ui.ButtonSet.OK);
  }
}

function fillMissingArtworkForSheet(sheet) {
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var playlistCol = headers.indexOf('playlist_url');
  var imageCol = headers.indexOf('show_image');
  if (playlistCol === -1 || imageCol === -1) {
    throw new Error('Could not find playlist_url/show_image columns in the header row.');
  }

  var updated = 0;
  for (var row = 1; row < values.length; row++) {
    var playlistUrl = values[row][playlistCol];
    var existingImage = values[row][imageCol];
    if (playlistUrl && !existingImage) {
      var artworkUrl = fetchPlaylistArtwork(playlistUrl);
      if (artworkUrl) {
        sheet.getRange(row + 1, imageCol + 1).setValue(artworkUrl);
        updated++;
      }
    }
  }
  return updated;
}

function fetchPlaylistArtwork(playlistUrl) {
  var response = UrlFetchApp.fetch(playlistUrl, {
    headers: {
      // Apple serves a stripped-down page without og:image tags to unrecognized clients.
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
    },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    return null;
  }
  var match = response.getContentText().match(/<meta property="og:image" content="([^"]+)"/i);
  return match ? match[1] : null;
}

function sheetToJson(sheet) {
  var timeZone = sheet.getParent().getSpreadsheetTimeZone();
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var rows = values.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (header, i) {
      obj[header] = formatCellValue(row[i], timeZone);
    });
    return obj;
  });
  return JSON.stringify(rows, null, 2);
}

function formatCellValue(value, timeZone) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, timeZone, 'yyyy-MM-dd');
  }
  return value;
}

function commitToGithub(path, content) {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    throw new Error('No GitHub token found. Run setGithubToken() first.');
  }

  var apiUrl = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + path;
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
    message: 'Update ' + path + ' from Google Sheet (' + new Date().toISOString() + ')',
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
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
