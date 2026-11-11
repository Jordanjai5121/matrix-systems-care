(function () {
  var C = window.MATRIX, A = window.ADMIN;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var sb = supabase.createClient(C.url, C.key);
  var tab = A.tabs[0], rows = [], editing = null;

  document.title = A.title;

  function loginView(msg) {
    $('#app').innerHTML = '<form id="lg" class="card login"><img src="/favicon-256.png" alt="Matrix logo" width="72" height="72">' +
      '<h1>' + esc(A.title) + '</h1>' +
      '<input id="em" type="email" placeholder="Admin email" autocomplete="username" required>' +
      '<input id="pw" type="password" placeholder="Password" autocomplete="current-password" required>' +
      '<button class="primary">Sign in</button><p class="err">' + esc(msg || '') + '</p></form>';
    $('#lg').onsubmit = function (e) {
      e.preventDefault();
      sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value }).then(function (r) {
        r.error ? loginView(r.error.message) : enter();
      });
    };
  }

  function enter() {
    sb.rpc('is_admin').then(function (r) {
      if (r.error || !r.data) { sb.auth.signOut(); return loginView('This account is not an admin. Add its email to the admins table.'); }
      shell(); load();
    });
  }

  function shell() {
    $('#app').innerHTML = '<header><img src="/favicon-32.png" alt="" width="28" height="28"><h1>' + esc(A.title) + '</h1>' +
      '<nav>' + A.tabs.map(function (t, i) { return '<button data-i="' + i + '" class="' + (t === tab ? 'on' : '') + '">' + esc(t.label) + '</button>'; }).join('') +
      '</nav><button id="out">Sign out</button></header><main id="main"></main>';
    document.querySelectorAll('nav button').forEach(function (b) {
      b.onclick = function () { tab = A.tabs[+b.dataset.i]; editing = null; shell(); load(); };
    });
    $('#out').onclick = function () { sb.auth.signOut().then(function () { loginView(); }); };
  }

  function load() {
    var q = sb.from(tab.table).select('*');
    if (tab.like) q = q.like(tab.like[0], tab.like[1]);
    var o = tab.order || { col: 'id', asc: false };
    q.order(o.col, { ascending: o.asc }).then(function (r) {
      if (r.error) { $('#main').innerHTML = '<p class="err">' + esc(r.error.message) + ' (did you run schema.sql?)</p>'; return; }
      rows = r.data; render();
    });
  }

  function cell(r, c) {
    var v = r[c.k];
    if (c.t === 'checkbox') return v ? 'Yes' : 'No';
    if (c.t === 'wa' && v) return '<a href="https://wa.me/' + (String(v).replace(/\D/g, '').length === 10 ? '91' : '') + String(v).replace(/\D/g, '') + '" target="_blank" rel="noopener">' + esc(v) + '</a>';
    if (c.t === 'date' && v) return esc(new Date(v).toLocaleString('en-IN'));
    if (c.t === 'img' && v) return '<img src="' + esc(v) + '" alt="" class="thumb">';
    return esc(v);
  }

  function render() {
    var pk = tab.pk || 'id';
    var h = '<div class="bar"><h2>' + esc(tab.label) + ' <small>' + rows.length + '</small></h2>' +
      (tab.noAdd ? '' : '<button class="primary" id="add">Add new</button>') + '</div>';
    if (tab.hint) h += '<p class="hint">' + esc(tab.hint) + '</p>';
    h += '<div id="form"></div><div class="scroll"><table><thead><tr>' +
      tab.cols.map(function (c) { return '<th>' + esc(c.l) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r, i) {
        return '<tr>' + tab.cols.map(function (c) { return '<td>' + cell(r, c) + '</td>'; }).join('') +
          '<td class="act"><button data-e="' + i + '">Edit</button>' + (tab.noDelete ? '' : '<button data-d="' + i + '" class="danger">Delete</button>') + '</td></tr>';
      }).join('') : '<tr><td colspan="' + (tab.cols.length + 1) + '" class="empty">Nothing here yet.</td></tr>') + '</tbody></table></div>';
    $('#main').innerHTML = h;
    if ($('#add')) $('#add').onclick = function () { form({}); };
    document.querySelectorAll('[data-e]').forEach(function (b) { b.onclick = function () { form(rows[+b.dataset.e]); }; });
    document.querySelectorAll('[data-d]').forEach(function (b) {
      b.onclick = function () {
        var r = rows[+b.dataset.d];
        if (!confirm('Delete this row permanently?')) return;
        sb.from(tab.table).delete().eq(pk, r[pk]).then(function (x) { x.error ? alert(x.error.message) : load(); });
      };
    });
  }

  function form(r) {
    var pk = tab.pk || 'id', isNew = r[pk] == null;
    editing = r;
    var h = '<form id="ef" class="card"><h3>' + (isNew ? 'Add' : 'Edit') + '</h3><div class="grid">' + tab.fields.map(function (f) {
      var v = r[f.k], id = 'f_' + f.k, dis = f.ro && !isNew ? ' disabled' : '';
      var lab = '<label for="' + id + '">' + esc(f.l) + '</label>';
      var hint = (f.h || (f.hk && r[f.hk])) ? '<small>' + esc(f.h || r[f.hk]) + '</small>' : '';
      var inp;
      if (f.t === 'textarea') inp = '<textarea id="' + id + '" rows="3"' + dis + '>' + esc(v) + '</textarea>';
      else if (f.t === 'select') inp = '<select id="' + id + '"' + dis + '>' + f.o.map(function (o) { return '<option' + ((v || f.o[0]) === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>';
      else if (f.t === 'checkbox') inp = '<input id="' + id + '" type="checkbox"' + ((v == null ? true : v) ? ' checked' : '') + '>';
      else inp = '<input id="' + id + '" type="' + (f.t === 'number' ? 'number' : 'text') + '"' + (f.t === 'number' ? ' step="any"' : '') + ' value="' + esc(v) + '"' + dis + (f.req ? ' required' : '') + '>';
      return '<div class="fld' + (f.t === 'textarea' ? ' wide' : '') + '">' + lab + inp + hint + '</div>';
    }).join('') + '</div><div class="row"><button class="primary">Save</button><button type="button" id="cx">Cancel</button></div><p class="err" id="fe"></p></form>';
    $('#form').innerHTML = h;
    $('#cx').onclick = function () { $('#form').innerHTML = ''; };
    $('#ef').onsubmit = function (e) {
      e.preventDefault();
      var d = {};
      tab.fields.forEach(function (f) {
        if (f.ro && !isNew) return;
        var el = $('#f_' + f.k);
        if (f.t === 'checkbox') d[f.k] = el.checked;
        else if (f.t === 'number') d[f.k] = el.value === '' ? null : Number(el.value);
        else d[f.k] = el.value.trim() === '' && !f.req ? null : el.value.trim();
      });
      if (tab.table === 'site_settings') d.updated_at = new Date().toISOString();
      var req = isNew ? sb.from(tab.table).insert(d) : sb.from(tab.table).update(d).eq(pk, r[pk]);
      req.then(function (x) { x.error ? ($('#fe').textContent = x.error.message) : load(); });
    };
    $('#form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  sb.auth.getSession().then(function (r) { r.data.session ? enter() : loginView(); });
})();
