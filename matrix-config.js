/* Matrix System Care: shared config.
   1. Paste your Supabase ANON (public) key below. Never put the service_role key here.
   2. Load this file on /tech and /innovation (see README in the reply) and on both admin pages. */
window.MATRIX = {
  url: 'https://lftjkyxftkkuldwjzvne.supabase.co',
  key: 'sb_publishable_vBJWBYsKiiDbd7gSQHW9xQ_nKjWXxAo '
};

(function () {
  var M = window.MATRIX;
  var m = location.pathname.match(/^\/(?:matrix-)?(tech|innovation)(?:\.html|\/)?$/);
  var site = m && m[1];
  if (!site) return; // admin pages and other pages: do nothing more

  // Fallbacks used if Supabase is unreachable
  var DEF = {
    tech: { whatsapp: '917639814304', phone: '917639814304', email: 'matrixsystem19@gmail.com' },
    innovation: { whatsapp: '918056359983', phone: '918056359983', email: 'matrixsystemcare26@gmail.com', instagram: 'premraj359' }
  };
  var S = Object.assign({}, DEF[site]);
  var H = { apikey: M.key, Authorization: 'Bearer ' + M.key };

  function fmt(n) { // 917639814304 -> +91 7639814304
    n = String(n).replace(/\D/g, '');
    return n.length === 12 ? '+91 ' + n.slice(2, 6) + ' ' + n.slice(6, 9) + ' ' + n.slice(9) : '+' + n;
  }
  function texts(el, fn) {
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) { var v = fn(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
  }

  function apply() {
    document.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href') || '', t = a.textContent;
      if (/wa\.me\//.test(h) || (h === '#' && /whatsapp/i.test(t))) {
        a.setAttribute('href', h === '#' ? 'https://wa.me/' + S.whatsapp : h.replace(/wa\.me\/\d+/, 'wa.me/' + S.whatsapp));
        texts(a, function (v) { return v.replace(/\+?\d[\d\s]{8,}\d/, fmt(S.whatsapp)); });
      } else if (/^tel:/.test(h)) {
        a.setAttribute('href', 'tel:+' + S.phone);
        texts(a, function (v) { return v.replace(/\+?\d[\d\s]{8,}\d/, fmt(S.phone)); });
      } else if (/^mailto:/.test(h)) {
        a.setAttribute('href', 'mailto:' + S.email);
        texts(a, function (v) { return v.replace(/[\w.+-]+@[\w.-]+/, S.email); });
      } else if (S.instagram && /instagram\.com\//.test(h)) {
        a.setAttribute('href', 'https://www.instagram.com/' + S.instagram);
        texts(a, function (v) { return v.replace(/@[\w.]+/, '@' + S.instagram); });
      }
    });
  }

  fetch(M.url + '/rest/v1/site_settings?select=key,value&key=like.' + site + '_*', { headers: H })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) { rows.forEach(function (r) { S[r.key.replace(site + '_', '')] = r.value; }); })
    .catch(function () {})
    .then(function () {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
      window.MatrixDB.settings = S;
    });

  function insert(table, row) {
    return fetch(M.url + '/rest/v1/' + table, {
      method: 'POST', keepalive: true,
      headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, H),
      body: JSON.stringify(row)
    }).catch(function () {});
  }

  function clean(obj) { // never store passwords
    var o = {};
    Object.keys(obj).forEach(function (k) { if (!/pass|pwd|otp/i.test(k) && typeof obj[k] === 'string') o[k] = obj[k]; });
    return o;
  }
  function pick(raw, re) {
    var k = Object.keys(raw).filter(function (x) { return re.test(x); })[0];
    return k ? raw[k] : null;
  }

  window.MatrixDB = {
    settings: S,
    // Call from your cart/order code: MatrixDB.logOrder({customer_name, mobile, items, message, total})
    logOrder: function (o) { return insert('innovation_orders', Object.assign({ status: 'new' }, o)); },
    logEnquiry: function (o) { return insert('tech_enquiries', Object.assign({ status: 'new' }, o)); }
  };

  // Log form submissions without interfering with the existing WhatsApp flow
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM' || f.querySelector('input[type=password]')) return;
    var raw = clean(Object.fromEntries(new FormData(f)));
    if (!Object.keys(raw).length) return;
    if (site === 'tech') {
      window.MatrixDB.logEnquiry({
        name: pick(raw, /name/i), mobile: pick(raw, /mobile|phone/i), email: pick(raw, /mail/i),
        category: pick(raw, /categ|service/i), device_type: pick(raw, /device/i),
        preferred_date: pick(raw, /date/i), problem: pick(raw, /problem|message|desc/i),
        location: pick(raw, /location|address/i), raw: raw
      });
    } else {
      window.MatrixDB.logOrder({
        customer_name: pick(raw, /name/i), mobile: pick(raw, /mobile|phone/i),
        message: pick(raw, /message|note|desc/i), raw: raw
      });
    }
  }, true);
})();
