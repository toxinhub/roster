/*
  এই ফাইলটাই রোস্টারের "ডেটা"। শিফট পরিবর্তন, অফ যোগ, নতুন কর্মী বা নতুন তারিখ
  সবকিছু এই ফাইল পরিবর্তন করলেই ওয়েবসাইটে সাথে সাথে দেখা যাবে।

  সহজ উপায়: admin.html পেজ থেকে ড্রপডাউন দিয়ে পরিবর্তন করে "কোড তৈরি করুন" চাপুন,
  তারপর যে কোডটা পাবেন সেটা কপি করে GitHub-এ এই ফাইলের জায়গায় পেস্ট করে Commit করুন।
*/

const SCHEDULE_DATA = {
  month: "সেপ্টেম্বর ২০২৬",

  updatedAt: "১৯ সেপ্টেম্বর, ২০২৬",

  shiftTypes: {
    A: { label: "শিফট A", note: "", color: "#F6B6AD" },
    B: { label: "শিফট B", note: "", color: "#F8DE7E" },
    C: { label: "শিফট C", note: "", color: "#A9D8E9" },
    OFF: { label: "ছুটি", note: "সাপ্তাহিক / নির্ধারিত ছুটি", color: "#B7E4C7" },
  },

  days: [
    { date: "২৫", weekday: "শুক্রবার" },
    { date: "২৬", weekday: "শনিবার" },
    { date: "২৭", weekday: "রবিবার" },
    { date: "২৮", weekday: "সোমবার" },
    { date: "২৯", weekday: "মঙ্গলবার" },
    { date: "৩০", weekday: "বুধবার" },
    { date: "১", weekday: "বৃহস্পতিবার" },
  ],

  employees: [
    { name: "আরমান", shifts: ["B", "B", "B", "B", "B", "B", "B"] },
    { name: "তন্ময়", shifts: ["A", "A", "OFF", "A", "A", "A", "A"] },
    { name: "আশিক", shifts: ["C", "C", "C", "C", "C", "C", "C"] },
  ]
};
