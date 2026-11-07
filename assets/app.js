const { units, title, subtitle } = window.SITE;
const $ = (s) => document.querySelector(s);
const link = (u, s) => s.file;

if ($('#units')) {
  $('#units').innerHTML = units.map(u => `
    <section class="unit" style="--c:${u.color}">
      <div class="unit-head"><span class="badge">${u.id}</span><div><h2>${u.title}</h2><p>${u.desc}</p></div></div>
      <ul>${u.subunits.map(s => `<li><a href="${link(u, s)}">${s.title}</a></li>`).join('')}</ul>
    </section>`).join('');
}

if ($('.hero h1')) $('.hero h1').textContent = title;
if ($('.hero .lede')) $('.hero .lede').textContent = subtitle;
