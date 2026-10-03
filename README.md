# 📹 CCTV · PJL — ডিউটি রোস্টার

CCTV · PJL টিমের জন্য তৈরি একটি **mobile-first, responsive duty roster**। এটি GitHub Pages-এ সরাসরি চলে এবং কোনো build tool বা framework ছাড়াই roster দেখা, মাস পরিবর্তন, live duty status এবং admin editing করা যায়।

**Live:** https://toxinhub.github.io/roster/

## ✨ বর্তমান ফিচার

### 📅 লাইভ রোস্টার
- Dhaka time অনুযায়ী **আজকের তারিখ ও day-progress indicator**।
- বর্তমান মাসের roster এবং আগের মাসের **archive view** দেখা যায়।
- মাসের পাশে compact **‹ / › navigation** দিয়ে মাস পরিবর্তন করা যায়।
- আজকের দিনের column-এ দ্রুত jump/center করা যায়।
- Friday → Thursday weekly boundaries visually আলাদা করা হয়।
- desktop-এ roster horizontal mouse-wheel ও click-drag scrolling সমর্থন করে।
- mobile-এ touch scrolling optimized।

### 🕐 শিফট
| Code | সময় | অর্থ |
|---|---|---|
| **A** | 06:00–14:00 | সকাল/দিনের শিফট |
| **B** | 14:00–22:00 | বিকেল/সন্ধ্যার শিফট |
| **C** | 22:00–06:00 | রাতের/overnight শিফট |
| **OFF** | — | নির্ধারিত ছুটি |
| **L** | — | অনুমোদিত ছুটি (Leave) |

### 👤 Live duty status
রোস্টারের নিচে/নামের সঙ্গে বর্তমান পরিস্থিতি স্বয়ংক্রিয়ভাবে দেখানো হয়:

- **ON DUTY - A/B/C** — বর্তমানে যে শিফট চলছে।
- **UPCOMING - A/B/C** — পরবর্তী প্রাসঙ্গিক শিফট।
- **OFF** — কোনো active/upcoming duty নেই।
- **LEAVE** — ঐ দিনের অনুমোদিত ছুটি।
- একই সময়ের duty transition হলে double-duty context-ও দেখানো হয়।
- ON DUTY কর্মীর নামের পাশে একটি ছোট active indicator থাকে।
- Status calculation Dhaka timezone অনুসরণ করে এবং live page নিয়মিত refresh হয়।

### 📋 Next Duty
Live roster-এর নিচে প্রতিটি কর্মীর জন্য:
- পরবর্তী **shift change**
- পরবর্তী **OFF/Leave**
- সংশ্লিষ্ট তারিখ

দেখানো হয়।

## 🗂️ মাসের archive

বর্তমান মাসের roster `schedule.json` থেকে আসে।

আগের মাসের archived roster:

```
archive/YYYY-MM.json
```

ফরম্যাটে রাখা হয়। ফলে মাস পরিবর্তন করলেও historical roster আলাদা করে দেখা যায়।

## ⚙️ Admin Panel

`admin.html` থেকে roster পরিচালনা করা যায়:

- মাস ও সাল পরিবর্তন
- তারিখ/বার সম্পাদনা
- কর্মী যোগ/সম্পাদনা
- A / B / C / OFF / L assignment
- পরিবর্তনের summary দেখা
- পরিবর্তন বাতিল করা
- `schedule.json`-এ GitHub-এ Save
- JSON Download
- প্রয়োজন হলে পুরোনো মাস archive করা

**Admin:** https://toxinhub.github.io/roster/admin.html

### GitHub connection

Admin panel-এ GitHub repository connection-এর জন্য:
- Username: `toxinhub`
- Repository: `roster`
- Branch: `main`
- Fine-grained GitHub token

প্রয়োজন।

Token-এর জন্য এই repository-তে **Contents: Read and write** permission যথেষ্ট।

Token browser-এর **sessionStorage**-এ রাখা হয় এবং session শেষ হলে আর থাকে না।

> ⚠️ `admin.html` আলাদা password protection ব্যবহার করে না। তাই trusted users-দের কাছেই admin link ও token access রাখা উচিত। কাজ শেষ হলে প্রয়োজন অনুযায়ী token revoke করা ভালো।

## 🎨 UI / UX

সাইটটি lightweight, warm এবং low-glare visual direction অনুসরণ করে:

- responsive desktop + mobile layout
- compact roster/table presentation
- light mode ও **Ink Mode**
- contrast-focused typography
- subtle glass/paper-like surfaces
- minimal borders and spacing
- initial **skeleton shimmer** loading state
- first roster render-এ subtle staggered entrance
- `prefers-reduced-motion` support
- mobile-এর জন্য compact footer note
- Bangla-first interface

## 📁 Project structure

```
/
├── index.html       # Live roster
├── admin.html       # Roster management
├── schedule.json    # Current roster data
├── archive/         # Previous-month roster snapshots
├── style.css        # Main responsive styling
├── landscape.css    # Legacy/compatibility layout overrides
├── schedule.js      # Legacy data format / compatibility
└── favicon.svg      # Site icon
```

## 🚀 Run locally

এটি একটি **build-free static site**।

Python থাকলে:

```bash
python3 -m http.server 8000
```

তারপর browser-এ:

```
http://localhost:8000/
```

খুলুন।

## 🔄 Data flow

```
schedule.json
     │
     ▼
 index.html
     │
     ├── Live duty status
     ├── Month navigation
     ├── Next Duty
     └── Responsive roster
     
 admin.html
     │
     ▼
 GitHub Contents API
     │
     ├── schedule.json
     └── archive/YYYY-MM.json
```

## 📝 Notes

- Current roster data-এর source of truth হলো `schedule.json`।
- Archive files historical reference হিসেবে ব্যবহৃত হয়।
- Site-টি static হওয়ায় কোনো server/database প্রয়োজন নেই।
- Browser cache এড়াতে roster data fetch করার সময় cache-busting query ব্যবহার করা হয়।
- JavaScript এবং CSS পরিবর্তনের পর deployment/cache propagation হতে কয়েক মুহূর্ত লাগতে পারে।

---

**CCTV · PJL Duty Roster**  
_একটি ছোট, practical team project — still under construction._