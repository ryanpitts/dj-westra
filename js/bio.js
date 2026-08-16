document.addEventListener('DOMContentLoaded', function () {
  fetch('data/bio.json')
    .then(function (response) { return response.json(); })
    .then(function (rows) {
      var bio = rows[0];
      var h1 = document.querySelector('h1');
      if (h1.textContent !== bio.name) {
        h1.textContent = bio.name;
      }

      var mailLink = document.querySelector('#contact a');
      var currentEmail = mailLink.href.replace(/^mailto:/, '');
      if (currentEmail !== bio.email) {
        mailLink.href = 'mailto:' + bio.email;
      }

      var bioEl = document.getElementById('bio');
      if (bioEl.textContent !== bio.bio) {
        bioEl.textContent = bio.bio;
      }
    });
});
