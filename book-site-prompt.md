# Claude Code Prompt — Illustration Review Site

## Project Overview

Build a **password-protected illustration review website** for a book project. The author can log in to review chapter illustrations, leave comments, and reply to feedback. The illustrator (admin) can upload and manage images directly through the site. No backend — everything is pure HTML/JS/CSS talking directly to Supabase.

---

## Tech Stack

- **Frontend**: Vanilla HTML + CSS + JS (single page app, no framework)
- **Database + Storage + Auth**: Supabase (JS SDK via CDN)
- **Hosting**: Cloudflare Pages
- **No build step, no Node, no bundler** — just files

---

## Supabase Setup (do this first before building)

### 1. Create these tables in Supabase SQL editor:

```sql
-- Chapters table
create table chapters (
  id uuid default gen_random_uuid() primary key,
  number integer not null unique,
  title text not null,
  description text,
  created_at timestamptz default now()
);

-- Images table
create table images (
  id uuid default gen_random_uuid() primary key,
  chapter_id uuid references chapters(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  caption text,
  sort_order integer default 0,
  uploaded_at timestamptz default now()
);

-- Comments table
create table comments (
  id uuid default gen_random_uuid() primary key,
  image_id uuid references images(id) on delete cascade,
  chapter_id uuid references chapters(id) on delete cascade,
  author text not null,
  body text not null,
  created_at timestamptz default now()
);
```

### 2. Create a Supabase Storage bucket:
- Bucket name: `illustrations`
- Set to **Public** (so images are viewable without auth)

### 3. Set RLS policies (run in SQL editor):

```sql
-- Allow public read on all tables
alter table chapters enable row level security;
alter table images enable row level security;
alter table comments enable row level security;

create policy "Public read chapters" on chapters for select using (true);
create policy "Public read images" on images for select using (true);
create policy "Public read comments" on comments for select using (true);
create policy "Public insert comments" on comments for insert with check (true);
create policy "Public insert chapters" on chapters for insert with check (true);
create policy "Public insert images" on images for insert with check (true);
create policy "Public update chapters" on chapters for update using (true);
create policy "Public delete images" on images for delete using (true);
```

### 4. Seed initial chapter data (run in SQL editor):
```sql
insert into chapters (number, title) values
(1, 'Chapter 1'), (2, 'Chapter 2'), (3, 'Chapter 3'),
(4, 'Chapter 4'), (5, 'Chapter 5'), (6, 'Chapter 6'),
(7, 'Chapter 7'), (8, 'Chapter 8'), (9, 'Chapter 9'),
(10, 'Chapter 10'), (11, 'Chapter 11'), (12, 'Chapter 12'),
(13, 'Chapter 13');
```

---

## Environment Variables

Create a `.env` file (and add to Cloudflare Pages environment variables):

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
ADMIN_PASSWORD=your_secret_admin_password
REVIEWER_PASSWORD=your_secret_reviewer_password
```

Since this is vanilla JS on Cloudflare Pages (no server-side env injection), handle this with a `config.js` file that gets populated during Cloudflare build, OR inline the public Supabase credentials directly (the anon key is safe to expose — it's public by design). The passwords must NOT be in client-side code. Instead:

**Password approach**: Store a hash of each password in a JS config. On login, hash the input client-side with SHA-256 and compare. This is sufficient for low-stakes access control on an internal review tool.

---

## File Structure

```
/
├── index.html          ← password gate
├── chapters.html       ← chapter grid (reviewer + admin)
├── chapter.html        ← single chapter view with images + comments
├── admin.html          ← admin upload/manage panel
├── config.js           ← supabase credentials + hashed passwords
├── supabase.js         ← supabase client init (loads from CDN)
├── auth.js             ← login/session logic
├── style.css           ← global styles
└── _redirects          ← Cloudflare Pages SPA routing
```

---

## Page-by-Page Spec

### `index.html` — Password Gate

- Full-screen centered login
- Single password field + submit button
- On submit: SHA-256 hash the input, compare against stored hashes in `config.js`
- If matches admin hash → set `sessionStorage.role = 'admin'`, redirect to `chapters.html`
- If matches reviewer hash → set `sessionStorage.role = 'reviewer'`, redirect to `chapters.html`
- If neither → show error "Wrong password"
- No username needed — just the password determines the role

### `chapters.html` — Chapter Grid

- Check `sessionStorage.role` on load — if not set, redirect to `index.html`
- Show site title and a **logout** button (top right)
- Grid of 13 chapter cards
- Each card shows:
  - Chapter number + title
  - Thumbnail of the first/title image (if uploaded)
  - Image count badge
  - Unread comment count badge (nice to have, can skip for v1)
- Clicking a card → `chapter.html?id=CHAPTER_ID`
- **Admin only**: Show a "+ New Chapter" button and an "Admin Panel" link in the nav

### `chapter.html` — Chapter Detail

- Back button to chapters grid
- Chapter title at top
- **Image gallery section**: display all images for this chapter, large, one per row or side by side
  - Each image shows its caption underneath
  - **Admin only**: delete button (×) on each image, edit caption inline
- **Comments section** below the images:
  - List of all comments for this chapter (not per-image for v1 — chapter-level is simpler)
  - Each comment shows: author name, body, timestamp
  - Comment form at bottom:
    - Name field (pre-fill "Author" for reviewer, "Illustrator" for admin based on role)
    - Comment textarea
    - Submit button
  - Comments load on page load, no polling needed

### `admin.html` — Admin Upload Panel

- Redirect to `index.html` if role is not `admin`
- Chapter selector dropdown (loads from Supabase)
- **Upload area**: drag-and-drop zone OR click to select file
  - Accepts: JPG, PNG, WebP
  - Shows preview before upload
  - Caption field (optional)
  - Upload button → uploads to Supabase Storage at path `chapter-{number}/{filename}`
  - On success: inserts row into `images` table with `storage_path` and `chapter_id`
  - Show progress indicator during upload
- **Manage existing**: list of all images for selected chapter with delete option
- **Chapter management**: edit chapter titles

---

## Auth Logic (`auth.js`)

```javascript
// On any protected page load:
function requireAuth() {
  const role = sessionStorage.getItem('role')
  if (!role) window.location.href = '/index.html'
  return role
}

function requireAdmin() {
  const role = requireAuth()
  if (role !== 'admin') window.location.href = '/chapters.html'
}

function logout() {
  sessionStorage.clear()
  window.location.href = '/index.html'
}
```

---

## Supabase Client (`supabase.js`)

Load Supabase via CDN in each HTML file:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

```javascript
// supabase.js
const supabaseClient = supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY
)
```

---

## Key Supabase Operations to Implement

**Load chapters:**
```javascript
const { data } = await supabaseClient.from('chapters').select('*').order('number')
```

**Load images for a chapter:**
```javascript
const { data } = await supabaseClient
  .from('images')
  .select('*')
  .eq('chapter_id', chapterId)
  .order('sort_order')
```

**Get public image URL:**
```javascript
const { data } = supabaseClient.storage
  .from('illustrations')
  .getPublicUrl(storagePath)
// data.publicUrl is the direct image URL
```

**Upload image:**
```javascript
const { data, error } = await supabaseClient.storage
  .from('illustrations')
  .upload(`chapter-${chapterNumber}/${filename}`, file, { upsert: true })
```

**Insert comment:**
```javascript
await supabaseClient.from('comments').insert({
  chapter_id: chapterId,
  author: authorName,
  body: commentText
})
```

**Load comments:**
```javascript
const { data } = await supabaseClient
  .from('comments')
  .select('*')
  .eq('chapter_id', chapterId)
  .order('created_at', { ascending: true })
```

---

## Design Direction

**Aesthetic**: Warm, editorial, book-like. Think a publisher's internal review tool — not a tech product.

- **Colour palette**: Off-white/cream background (`#FAF7F2`), deep ink (`#1C1C1E`), warm terracotta accent (`#C4603A`)
- **Typography**: Use Google Fonts — `Playfair Display` for headings (book-like, editorial), `Source Sans 3` for body/UI
- **Chapter cards**: Clean cards with subtle drop shadow, chapter number as large faded watermark behind the thumbnail
- **No rounded pill buttons** — slightly rounded or square, understated
- **Image display**: Full-width images with generous padding, white card background, subtle border
- **Comments**: Looks like margin notes — slightly indented, small font, timestamp in muted colour
- **Overall feel**: This is a creative collaboration tool, not a SaaS dashboard — it should feel warm and intentional

---

## `_redirects` file (for Cloudflare Pages SPA routing)

```
/* /index.html 200
```

---

## Cloudflare Pages Deployment Notes

- Connect GitHub repo in Cloudflare Pages
- Build command: *(leave blank — no build step)*
- Output directory: `/` (root)
- Add environment variables in Cloudflare Pages dashboard:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `ADMIN_PASSWORD_HASH` (SHA-256 hex of the admin password)
  - `REVIEWER_PASSWORD_HASH` (SHA-256 hex of the reviewer password)

Since Cloudflare Pages static sites can't inject env vars at runtime into JS, generate the `config.js` at build time using a simple build script, OR simply hardcode the Supabase public credentials directly in `config.js` (the anon key is safe — it's designed to be public, protected by RLS). For passwords, pre-compute the SHA-256 hashes and hardcode those (not the plaintext passwords).

**To generate SHA-256 hash of a password:**
```javascript
// Run this once in browser console to get the hash:
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
hashPassword('your-password-here').then(console.log)
```

---

## v1 Scope — What to Build Now

- [x] Password gate with two roles
- [x] Chapter grid with thumbnails
- [x] Chapter detail with full images
- [x] Chapter-level comments (not per-image)
- [x] Admin upload via drag-and-drop
- [x] Admin delete image
- [x] Edit chapter titles

## Leave for Later

- Per-image comments
- Email notification when author comments
- Image reordering (drag to sort)
- Lightbox / full-screen image view
- Comment replies / threading
