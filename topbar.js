/* ============================================================
   LIFE OS — shared topbar
   Drop <script src="topbar.js" defer></script> on any page and
   this injects the nav bar. Add pages to NAV as we build them;
   `soon:true` shows them greyed with a "coming soon" tap.
   The current page auto-highlights from its filename.
   ============================================================ */
(function () {
  'use strict';

  // icon set = Tabler (loaded via CDN link the pages include)
  var NAV = [
    { id: 'home',      label: 'Home',    icon: 'ti-layout-grid',      href: 'index.html' },
    { id: 'physical',  label: 'Body',    icon: 'ti-activity',         href: 'physical.html' },
    { id: 'appearance',label: 'Look',    icon: 'ti-sparkles',         href: 'appearance.html' },
    { id: 'cognition', label: 'Mind',    icon: 'ti-brain',            href: 'cognition.html',  soon: true },
    { id: 'social',    label: 'Social',  icon: 'ti-users',            href: 'social.html',     soon: true },
    { id: 'money',     label: 'Money',   icon: 'ti-currency-pound',   href: 'money.html' },
    { id: 'system',    label: 'System',  icon: 'ti-adjustments',      href: 'system.html',     soon: true }
  ];

  function currentFile() {
    var p = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    return p === '' ? 'index.html' : p;
  }

  function build() {
    var here = currentFile();
    var bar = document.createElement('nav');
    bar.className = 'topbar';

    var brand = document.createElement('div');
    brand.className = 'topbar-brand';
    brand.textContent = 'LIFE OS';
    bar.appendChild(brand);

    NAV.forEach(function (item) {
      var el = document.createElement('a');
      el.className = 'topbar-item';
      if (item.href.toLowerCase() === here) el.classList.add('is-active');
      if (item.soon) el.classList.add('is-soon');
      el.innerHTML = '<i class="ti ' + item.icon + '"></i><span>' + item.label + '</span>';

      if (item.soon) {
        el.href = 'javascript:void(0)';
        el.addEventListener('click', function () { toast(item.label + ' — coming soon'); });
      } else {
        el.href = item.href;
      }
      bar.appendChild(el);
    });

    document.body.insertBefore(bar, document.body.firstChild);
  }

  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('lo-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'lo-toast';
      t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(10px);' +
        'background:rgba(20,10,10,0.92);border:1px solid var(--hair);color:var(--text-1);' +
        'font:600 12px/1 var(--font,sans-serif);padding:11px 16px;border-radius:12px;z-index:500;' +
        'opacity:0;transition:opacity .2s,transform .2s;backdrop-filter:blur(12px);pointer-events:none;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(function () { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(10px)';
    }, 1900);
  }
  window.loToast = toast;

  // expose the nav config so pages can flip `soon` off as we build them
  window.LO_NAV = NAV;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
