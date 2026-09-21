# ডিউটি রোস্টার ওয়েবসাইট — আপডেটেড ভার্সন

বাংলা ভাষায় তৈরি একটি সহজ, মোবাইল-ফ্রেন্ডলি ডিউটি রোস্টার ওয়েবসাইট। GitHub Pages-এ সরাসরি চালানো যায় এবং `admin.html` থেকে শিফট পরিবর্তন করা যায়।

## ফাইলগুলো

- `index.html` — লাইভ রোস্টার পেজ
- `admin.html` — শিফট, কর্মী ও তারিখ সম্পাদনার পেজ
- `schedule.json` — রোস্টারের বর্তমান ডেটা
- `style.css` — সম্পূর্ণ ভিজ্যুয়াল ডিজাইন ও responsive mobile layout
- `landscape.css` — পুরনো layout override; বর্তমানে `style.css`-ই মূল responsive stylesheet
- `schedule.js` — পুরনো ডেটা ফরম্যাট; বর্তমানে সাইট `schedule.json` ব্যবহার করে

## চালানো

এটি একটি build-free static site। GitHub Pages-এ `main` branch এবং repository root নির্বাচন করুন। লোকালভাবে চালাতে:

```bash
python3 -m http.server 8000
```

তারপর `http://localhost:8000/` খুলুন।

- লাইভ রোস্টার: `/index.html`
- অ্যাডমিন এডিটর: `/admin.html`

## রোস্টার সম্পাদনা

`admin.html`-এ:

1. কোনো শিফট বাটনে ক্লিক করুন।
2. `A`, `B`, `C` অথবা `OFF` বেছে নিন।
3. প্রয়োজন হলে নতুন তারিখ বা কর্মী যোগ করুন।
4. **সংরক্ষণ করুন** চাপলে GitHub API দিয়ে `schedule.json` আপডেট হবে।

এক-ক্লিকে সংরক্ষণের জন্য একটি fine-grained GitHub personal access token প্রয়োজন, যার repository Contents permission `Read and write`। টোকেনটি শুধু ওই ব্রাউজারের `localStorage`-এ রাখা হয়। টোকেন না দিতে চাইলে manual JSON copy-paste পদ্ধতি ব্যবহার করা যাবে।

## মোবাইল ডিজাইন

সাইটটি এখন mobile-first responsive layout ব্যবহার করে:

- ছোট স্ক্রিনে roster table horizontal scroll করা যায়
- কর্মী কলাম sticky থাকে
- admin controls এক কলামে সাজানো হয়
- বড় স্ক্রিনে table, cards, legend ও editor panel পরিষ্কার dashboard layout-এ দেখা যায়
- কোনো build tool বা external framework দরকার নেই

## নিরাপত্তা নোট

`admin.html` password-protected নয়। শুধু trusted users-দের admin link দিন এবং কাজ শেষ হলে GitHub token revoke করুন।
