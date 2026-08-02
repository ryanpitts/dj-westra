document.addEventListener('DOMContentLoaded', function () {
  fetch('data/shows.csv')
    .then(function (response) { return response.text(); })
    .then(function (text) {
      var shows = parseCsv(text);
      var today = new Date();
      today.setHours(0, 0, 0, 0);

      var upcoming = shows.filter(function (show) { return show.dateObj >= today; })
        .sort(function (a, b) { return a.dateObj - b.dateObj; });
      var recent = shows.filter(function (show) { return show.dateObj < today; })
        .sort(function (a, b) { return b.dateObj - a.dateObj; });

      renderShows('upcoming-shows', upcoming, true);
      renderShows('recent-shows', recent, false);
    });
});

function parseCsv(text) {
  var lines = text.trim().split('\n');
  var headers = lines[0].split(',');
  return lines.slice(1).map(function (line) {
    var values = line.split(',');
    var show = {};
    headers.forEach(function (header, i) {
      show[header.trim()] = values[i] ? values[i].trim() : '';
    });
    show.dateObj = parseDate(show.date);
    return show;
  });
}

function parseDate(isoDate) {
  var parts = isoDate.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function formatDate(dateObj, includeWeekday) {
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var date = months[dateObj.getMonth()] + ' ' + dateObj.getDate();
  return includeWeekday ? days[dateObj.getDay()] + ', ' + date : date;
}

function formatTime(time) {
  var match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '';
  var hour = match[1];
  var minutes = match[2];
  var meridiem = match[3].toLowerCase();
  return minutes === '00' ? hour + meridiem : hour + ':' + minutes + meridiem;
}

function renderShows(listId, shows, includeWeekday) {
  var list = document.getElementById(listId);
  shows.forEach(function (show) {
    var li = document.createElement('li');
    var time = formatTime(show.time);
    var dateText = formatDate(show.dateObj, includeWeekday) + (time ? ', ' + time : '');
    li.appendChild(document.createTextNode(dateText + ' at '));

    if (show.venue_url) {
      var venueLink = document.createElement('a');
      venueLink.href = show.venue_url;
      venueLink.textContent = show.venue;
      li.appendChild(venueLink);
    } else {
      li.appendChild(document.createTextNode(show.venue));
    }

    if (show.apple_playlist) {
      li.appendChild(document.createTextNode(' ~ '));
      var playlistLabelFull = document.createElement('span');
      playlistLabelFull.className = 'playlist-label-full';
      playlistLabelFull.textContent = 'listen to the ';
      li.appendChild(playlistLabelFull);
      li.appendChild(document.createTextNode('playlist '));
      var link = document.createElement('a');
      link.href = show.apple_playlist;
      link.className = 'apple-icon';
      li.appendChild(link);
    }

    list.appendChild(li);
  });
}
