const Horizon = {
  MAX_LINKS: 12,

  DEFAULT_LINKS: [
    { id: 'yt', title: 'YouTube', url: 'https://www.youtube.com', color: '#ff4d4d' },
    { id: 'mail', title: 'Gmail', url: 'https://mail.google.com', color: '#ea4335' },
    { id: 'gh', title: 'GitHub', url: 'https://github.com', color: '#8b8b8b' },
    { id: 'maps', title: 'Maps', url: 'https://maps.google.com', color: '#34a853' },
    { id: 'drive', title: 'Drive', url: 'https://drive.google.com', color: '#fbbc04' },
    { id: 'wiki', title: 'Wikipedia', url: 'https://www.wikipedia.org', color: '#d8d8d8' }
  ],

  state: {
    version: 2,
    name: 'there',
    clock24: false,
    sky: { mode: 'dawn', color: '#c47b48', imageUrl: '' },
    links: []
  },

  init() {
    Horizon.Storage.load();
    Horizon.Sky.apply();
    Horizon.Clock.start();
    Horizon.Greeting.render();
    Horizon.Search.init();
    Horizon.Links.render();
    Horizon.Settings.init();
    Horizon.Modal.init();
    Horizon.Hotkeys.init();
  },

  uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  },

  normalizeUrl(raw) {
    let u = String(raw || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/\//, '');
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      return parsed.href;
    } catch {
      return '';
    }
  },

  // --- STORAGE ---
  Storage: {
    KEY: 'horizon.v2',
    load() {
      try {
        const raw = localStorage.getItem(Horizon.Storage.KEY);
        if (raw) {
          const data = JSON.parse(raw);
          Horizon.state = {
            version: 2,
            name: data.name || 'there',
            clock24: !!data.clock24,
            sky: {
              mode: (data.sky && data.sky.mode) || 'dawn',
              color: (data.sky && data.sky.color) || '#c47b48',
              imageUrl: (data.sky && data.sky.imageUrl) || ''
            },
            links: Array.isArray(data.links) ? data.links : Horizon.DEFAULT_LINKS.slice()
          };
          return;
        }

        const name = localStorage.getItem('horizon_name');
        const clock24 = localStorage.getItem('horizon_clock24');
        if (name !== null) Horizon.state.name = name;
        if (clock24 !== null) Horizon.state.clock24 = clock24 === 'true';
        Horizon.state.links = Horizon.DEFAULT_LINKS.slice();
        Horizon.Storage.save();
      } catch (e) {
        Horizon.state.links = Horizon.DEFAULT_LINKS.slice();
      }
    },
    save() {
      try {
        Horizon.state.version = 2;
        localStorage.setItem(Horizon.Storage.KEY, JSON.stringify(Horizon.state));
      } catch (e) {}
    }
  },

  // --- CLOCK ---
  Clock: {
    el: null,
    dateEl: null,
    start() {
      Horizon.Clock.el = document.getElementById('clock');
      Horizon.Clock.dateEl = document.getElementById('date');
      Horizon.Clock.update();
      setInterval(Horizon.Clock.update, 1000);
    },
    update() {
      const now = new Date();
      let hours = now.getHours();
      const mins = now.getMinutes().toString().padStart(2, '0');

      if (!Horizon.state.clock24) {
        hours = hours % 12 || 12;
      } else {
        hours = hours.toString().padStart(2, '0');
      }

      Horizon.Clock.el.textContent = `${hours}:${mins}`;
      Horizon.Clock.dateEl.textContent = now.toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric'
      });
    }
  },

  // --- GREETING ---
  Greeting: {
    timeEl: null,
    nameEl: null,
    render() {
      Horizon.Greeting.timeEl = document.getElementById('greeting-time');
      Horizon.Greeting.nameEl = document.getElementById('greeting-name');

      const hour = new Date().getHours();
      let greetingText = 'Good evening,';
      if (hour >= 5 && hour < 12) greetingText = 'Good morning,';
      else if (hour >= 12 && hour < 17) greetingText = 'Good afternoon,';
      else if (hour >= 21 || hour < 5) greetingText = 'Good night,';

      Horizon.Greeting.timeEl.textContent = greetingText;
      Horizon.Greeting.nameEl.textContent = Horizon.state.name;

      Horizon.Greeting.nameEl.addEventListener('blur', (e) => {
        const newName = e.target.textContent.trim() || 'there';
        Horizon.state.name = newName;
        e.target.textContent = newName;
        const input = document.getElementById('setting-name');
        if (input) input.value = newName === 'there' ? '' : newName;
        Horizon.Storage.save();
      });

      Horizon.Greeting.nameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
      });
    }
  },

  // --- SEARCH ---
  Search: {
    init() {
      const form = document.getElementById('search-form');
      form.addEventListener('submit', (e) => {
        const input = document.getElementById('search-input');
        if (!input.value.trim()) e.preventDefault();
      });
    },
    focus() {
      document.getElementById('search-input').focus();
    }
  },

  // --- SKY ---
  Sky: {
    apply() {
      const sky = Horizon.state.sky;
      const root = document.documentElement;
      root.dataset.sky = sky.mode || 'dawn';
      root.style.setProperty('--custom-base', sky.color || '#c47b48');
      if (sky.mode === 'image' && sky.imageUrl) {
        root.style.setProperty('--sky-image', `url("${sky.imageUrl.replace(/"/g, '')}")`);
      }
      Horizon.Sky.syncUi();
    },

    setMode(mode) {
      Horizon.state.sky.mode = mode;
      Horizon.Storage.save();
      Horizon.Sky.apply();
      Horizon.Toast.show('Sky updated');
    },

    setCustomColor(hex) {
      Horizon.state.sky.color = hex;
      Horizon.state.sky.mode = 'custom';
      Horizon.Storage.save();
      Horizon.Sky.apply();
      Horizon.Toast.show('Sky updated');
    },

    setImage(url) {
      const clean = Horizon.normalizeUrl(url);
      if (!clean) {
        Horizon.Toast.show('That URL is not valid');
        return;
      }

      const probe = new Image();
      probe.onload = () => {
        Horizon.state.sky.imageUrl = clean;
        Horizon.state.sky.mode = 'image';
        Horizon.Storage.save();
        Horizon.Sky.apply();
        Horizon.Toast.show('Sky updated');
      };
      probe.onerror = () => {
        Horizon.state.sky.mode = 'dawn';
        Horizon.Storage.save();
        Horizon.Sky.apply();
        Horizon.Toast.show('Image failed — back to Dawn');
      };
      probe.src = clean;
    },

    syncUi() {
      const mode = Horizon.state.sky.mode;
      document.querySelectorAll('.sky-swatch').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.sky === mode);
      });
      const color = document.getElementById('setting-color');
      const image = document.getElementById('setting-image');
      if (color) color.value = Horizon.state.sky.color || '#c47b48';
      if (image && Horizon.state.sky.imageUrl) image.value = Horizon.state.sky.imageUrl;
    }
  },

  // --- LINKS ---
  Links: {
    dragId: null,

    render() {
      const nav = document.getElementById('links');
      nav.replaceChildren();

      Horizon.state.links.forEach((link, index) => {
        nav.appendChild(Horizon.Links.tile(link, index));
      });

      if (Horizon.state.links.length < Horizon.MAX_LINKS) {
        nav.appendChild(Horizon.Links.addTile());
      }
    },

    tile(link, index) {
      const a = document.createElement('a');
      a.className = 'link-tile';
      a.href = link.url;
      a.rel = 'noopener noreferrer';
      a.draggable = true;
      a.dataset.id = link.id;
      a.tabIndex = 0;
      a.title = link.title;

      const icon = document.createElement('div');
      icon.className = 'tile-icon';
      icon.style.setProperty('--tile-color', link.color || '#e8a838');

      const letter = document.createElement('span');
      letter.className = 'tile-letter';
      letter.textContent = (link.title || '?').trim().charAt(0).toUpperCase();

      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      try {
        img.src = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(new URL(link.url).hostname) + '&sz=64';
      } catch {
        img.src = '';
      }
      img.addEventListener('load', () => img.classList.add('is-on'));
      img.addEventListener('error', () => img.remove());

      icon.append(letter, img);

      const label = document.createElement('span');
      label.className = 'tile-label';
      label.textContent = link.title;

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'tile-edit';
      edit.setAttribute('aria-label', 'Edit ' + link.title);
      edit.textContent = '✎';
      edit.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        Horizon.Modal.open(link);
      });

      a.append(icon, label, edit);

      a.addEventListener('dragstart', (e) => {
        Horizon.Links.dragId = link.id;
        a.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', link.id);
      });
      a.addEventListener('dragend', () => {
        Horizon.Links.dragId = null;
        a.classList.remove('dragging');
        document.querySelectorAll('.link-tile.is-drop').forEach((el) => el.classList.remove('is-drop'));
      });
      a.addEventListener('dragover', (e) => {
        e.preventDefault();
        a.classList.add('is-drop');
      });
      a.addEventListener('dragleave', () => a.classList.remove('is-drop'));
      a.addEventListener('drop', (e) => {
        e.preventDefault();
        a.classList.remove('is-drop');
        Horizon.Links.move(Horizon.Links.dragId, link.id);
      });

      a.addEventListener('keydown', (e) => {
        if (!(e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'))) return;
        e.preventDefault();
        const next = e.key === 'ArrowLeft' ? index - 1 : index + 1;
        Horizon.Links.moveIndex(index, next);
      });

      return a;
    },

    addTile() {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'link-tile tile-add';
      btn.setAttribute('aria-label', 'Add link');

      const icon = document.createElement('div');
      icon.className = 'tile-icon';
      icon.textContent = '+';

      const label = document.createElement('span');
      label.className = 'tile-label';
      label.textContent = 'Add';

      btn.append(icon, label);
      btn.addEventListener('click', () => Horizon.Modal.open(null));
      return btn;
    },

    move(fromId, toId) {
      if (!fromId || fromId === toId) return;
      const links = Horizon.state.links;
      const from = links.findIndex((l) => l.id === fromId);
      const to = links.findIndex((l) => l.id === toId);
      if (from < 0 || to < 0) return;
      const [item] = links.splice(from, 1);
      links.splice(to, 0, item);
      Horizon.Storage.save();
      Horizon.Links.render();
    },

    moveIndex(from, to) {
      const links = Horizon.state.links;
      if (to < 0 || to >= links.length) return;
      const [item] = links.splice(from, 1);
      links.splice(to, 0, item);
      Horizon.Storage.save();
      Horizon.Links.render();
      const tiles = document.querySelectorAll('.link-tile[data-id]');
      if (tiles[to]) tiles[to].focus();
    },

    save(payload, editingId) {
      if (editingId) {
        const i = Horizon.state.links.findIndex((l) => l.id === editingId);
        if (i >= 0) Horizon.state.links[i] = { ...Horizon.state.links[i], ...payload };
      } else {
        if (Horizon.state.links.length >= Horizon.MAX_LINKS) {
          Horizon.Toast.show('Maximum of 12 links');
          return false;
        }
        Horizon.state.links.push({ id: Horizon.uid(), ...payload });
      }
      Horizon.Storage.save();
      Horizon.Links.render();
      Horizon.Toast.show('Link saved');
      return true;
    },

    remove(id) {
      Horizon.state.links = Horizon.state.links.filter((l) => l.id !== id);
      Horizon.Storage.save();
      Horizon.Links.render();
      Horizon.Toast.show('Link deleted');
    },

    reset() {
      Horizon.state.links = Horizon.DEFAULT_LINKS.map((l) => ({ ...l }));
      Horizon.Storage.save();
      Horizon.Links.render();
      Horizon.Toast.show('Links reset');
    }
  },

  // --- MODAL ---
  Modal: {
    editingId: null,
    lastFocus: null,

    init() {
      document.getElementById('link-save').addEventListener('click', Horizon.Modal.commit);
      document.getElementById('link-cancel').addEventListener('click', Horizon.Modal.close);
      document.getElementById('link-modal-overlay').addEventListener('click', Horizon.Modal.close);
      document.getElementById('link-delete').addEventListener('click', () => {
        if (Horizon.Modal.editingId) {
          Horizon.Links.remove(Horizon.Modal.editingId);
          Horizon.Modal.close();
        }
      });
      document.getElementById('link-url').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') Horizon.Modal.commit();
      });
    },

    open(link) {
      Horizon.Modal.lastFocus = document.activeElement;
      Horizon.Modal.editingId = link ? link.id : null;
      document.getElementById('link-modal-title').textContent = link ? 'Edit link' : 'Add link';
      document.getElementById('link-title').value = link ? link.title : '';
      document.getElementById('link-url').value = link ? link.url : '';
      document.getElementById('link-color').value = link && link.color ? link.color : '#e8a838';
      document.getElementById('link-delete').classList.toggle('hidden', !link);
      document.getElementById('link-modal').classList.remove('hidden');
      document.getElementById('link-title').focus();
    },

    close() {
      document.getElementById('link-modal').classList.add('hidden');
      Horizon.Modal.editingId = null;
      if (Horizon.Modal.lastFocus) Horizon.Modal.lastFocus.focus();
    },

    isOpen() {
      return !document.getElementById('link-modal').classList.contains('hidden');
    },

    commit() {
      const title = document.getElementById('link-title').value.trim();
      const url = Horizon.normalizeUrl(document.getElementById('link-url').value);
      const color = document.getElementById('link-color').value || '#e8a838';
      if (!title || !url) {
        Horizon.Toast.show('Name and a valid URL are required');
        return;
      }
      const ok = Horizon.Links.save({ title, url, color }, Horizon.Modal.editingId);
      if (ok) Horizon.Modal.close();
    }
  },

  // --- SETTINGS ---
  Settings: {
    panel: null,
    lastFocus: null,

    init() {
      Horizon.Settings.panel = document.getElementById('settings-panel');
      const trigger = document.getElementById('settings-trigger');
      const closeBtn = document.getElementById('settings-close');
      const overlay = document.getElementById('settings-overlay');
      const nameInput = document.getElementById('setting-name');
      const toggleBtns = document.querySelectorAll('.toggle-btn');

      trigger.addEventListener('click', Horizon.Settings.open);
      closeBtn.addEventListener('click', Horizon.Settings.close);
      overlay.addEventListener('click', Horizon.Settings.close);

      nameInput.value = Horizon.state.name === 'there' ? '' : Horizon.state.name;
      toggleBtns.forEach((btn) => {
        btn.classList.toggle('active',
          (btn.dataset.format === '24' && Horizon.state.clock24) ||
          (btn.dataset.format === '12' && !Horizon.state.clock24)
        );
      });

      nameInput.addEventListener('input', (e) => {
        const newName = e.target.value.trim() || 'there';
        Horizon.state.name = newName;
        Horizon.Greeting.nameEl.textContent = newName;
        Horizon.Storage.save();
      });

      toggleBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          Horizon.state.clock24 = e.currentTarget.dataset.format === '24';
          Horizon.Storage.save();
          toggleBtns.forEach((b) => b.classList.remove('active'));
          e.currentTarget.classList.add('active');
          Horizon.Clock.update();
          Horizon.Toast.show('Time format updated');
        });
      });

      document.querySelectorAll('.sky-swatch').forEach((btn) => {
        btn.addEventListener('click', () => Horizon.Sky.setMode(btn.dataset.sky));
      });

      document.getElementById('apply-color').addEventListener('click', () => {
        Horizon.Sky.setCustomColor(document.getElementById('setting-color').value);
      });

      document.getElementById('apply-image').addEventListener('click', () => {
        Horizon.Sky.setImage(document.getElementById('setting-image').value);
      });

      document.getElementById('setting-image').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') Horizon.Sky.setImage(e.target.value);
      });

      document.querySelectorAll('.preset').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.getElementById('setting-image').value = btn.dataset.img;
          Horizon.Sky.setImage(btn.dataset.img);
        });
      });

      document.getElementById('reset-links').addEventListener('click', Horizon.Links.reset);

      Horizon.Sky.syncUi();
    },

    open() {
      Horizon.Settings.lastFocus = document.activeElement;
      Horizon.Settings.panel.classList.remove('hidden');
      document.getElementById('setting-name').focus();
    },

    close() {
      Horizon.Settings.panel.classList.add('hidden');
      if (Horizon.Settings.lastFocus) Horizon.Settings.lastFocus.focus();
    },

    isOpen() {
      return !Horizon.Settings.panel.classList.contains('hidden');
    },

    trap(e, root) {
      if (e.key !== 'Tab') return;
      const nodes = [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => !el.classList.contains('hidden') && !el.disabled);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  },

  // --- TOAST ---
  Toast: {
    show(msg) {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = msg;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 2500);
    }
  },

  // --- HOTKEYS ---
  Hotkeys: {
    init() {
      document.addEventListener('keydown', (e) => {
        const tag = e.target.tagName;
        const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;

        if (e.key === 'Escape') {
          if (Horizon.Modal.isOpen()) Horizon.Modal.close();
          else if (Horizon.Settings.isOpen()) Horizon.Settings.close();
          else if (isInput) e.target.blur();
          return;
        }

        if (e.key === 'Tab') {
          if (Horizon.Modal.isOpen()) Horizon.Settings.trap(e, document.getElementById('link-modal-box'));
          else if (Horizon.Settings.isOpen()) Horizon.Settings.trap(e, document.getElementById('settings-content'));
        }

        if (isInput) return;

        if (e.key === '/' || e.key === 's') {
          e.preventDefault();
          Horizon.Search.focus();
        } else if (e.key === 'g') {
          Horizon.Settings.open();
        }
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', Horizon.init);