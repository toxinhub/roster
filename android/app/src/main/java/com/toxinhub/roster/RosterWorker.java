package com.toxinhub.roster;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.text.TextUtils;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Constraints;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Calendar;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

public class RosterWorker extends Worker {
    public static final String WORK_NAME = "cctv_roster_background_check";
    private static final String SCHEDULE_URL = "https://toxinhub.github.io/roster/schedule.json";
    private static final String CHANNEL_ID = "duty_updates";
    private static final long FOUR_HOURS_MS = 4L * 60L * 60L * 1000L;

    public RosterWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    public static void schedule(Context context) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                RosterWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build();

        WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniquePeriodicWork(
                        WORK_NAME,
                        androidx.work.ExistingPeriodicWorkPolicy.KEEP,
                        request);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            if (BuildNotificationPermissionBlocked()) return Result.success();

            String json = download();
            if (TextUtils.isEmpty(json)) return Result.retry();

            JSONObject root = new JSONObject(json);
            JSONArray days = root.optJSONArray("days");
            JSONArray employees = root.optJSONArray("employees");
            if (days == null || employees == null) return Result.success();

            Calendar now = Calendar.getInstance(TimeZone.getTimeZone("Asia/Dhaka"));
            long nowMs = now.getTimeInMillis();

            for (int i = 0; i < employees.length(); i++) {
                JSONObject employee = employees.optJSONObject(i);
                if (employee == null) continue;

                String name = employee.optString("name", "");
                JSONArray shifts = employee.optJSONArray("shifts");
                if (TextUtils.isEmpty(name) || shifts == null) continue;

                String bestCode = "";
                String bestDate = "";
                long bestStart = Long.MAX_VALUE;

                for (int d = 0; d < Math.min(days.length(), shifts.length()); d++) {
                    JSONObject day = days.optJSONObject(d);
                    if (day == null) continue;

                    String iso = day.optString("isoDate", "");
                    String code = shifts.optString(d, "");
                    if (TextUtils.isEmpty(iso) || !("A".equals(code) || "B".equals(code) || "C".equals(code))) {
                        continue;
                    }

                    long start = shiftStart(iso, code);
                    if (start > nowMs && start < bestStart) {
                        bestStart = start;
                        bestCode = code;
                        bestDate = iso;
                    }
                }

                if (!bestCode.isEmpty() && bestStart - nowMs <= FOUR_HOURS_MS) {
                    String key = name + "|" + bestDate + "|" + bestCode;
                    String oldKey = getApplicationContext()
                            .getSharedPreferences("roster_notifications", Context.MODE_PRIVATE)
                            .getString("last_upcoming", "");

                    if (!key.equals(oldKey)) {
                        sendNotification(
                                "পরবর্তী ডিউটি",
                                name + " • " + bestCode + " শিফট ৪ ঘণ্টার মধ্যে শুরু হবে");
                        getApplicationContext()
                                .getSharedPreferences("roster_notifications", Context.MODE_PRIVATE)
                                .edit()
                                .putString("last_upcoming", key)
                                .apply();
                    }
                }
            }

            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    private boolean BuildNotificationPermissionBlocked() {
        return android.os.Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(
                getApplicationContext(),
                Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED;
    }

    private String download() throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(SCHEDULE_URL).openConnection();
        c.setConnectTimeout(10000);
        c.setReadTimeout(10000);
        c.setRequestMethod("GET");
        c.setRequestProperty("Cache-Control", "no-cache");
        try {
            if (c.getResponseCode() != HttpURLConnection.HTTP_OK) return "";
            BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream()));
            StringBuilder out = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) out.append(line);
            r.close();
            return out.toString();
        } finally {
            c.disconnect();
        }
    }

    private long shiftStart(String iso, String code) {
        String[] p = iso.split("-");
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("Asia/Dhaka"));
        c.clear();
        c.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]), 0, 0, 0);
        int hour = "A".equals(code) ? 6 : ("B".equals(code) ? 14 : 22);
        c.set(Calendar.HOUR_OF_DAY, hour);
        return c.getTimeInMillis();
    }

    private void sendNotification(String title, String message) {
        NotificationManager manager =
                (NotificationManager) getApplicationContext().getSystemService(Context.NOTIFICATION_SERVICE);

        if (android.os.Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    getApplicationContext().getString(R.string.notification_channel_name),
                    NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription(getApplicationContext().getString(R.string.notification_channel_description));
            manager.createNotificationChannel(channel);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(
                getApplicationContext(), CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_launcher)
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true);

        manager.notify(2001, builder.build());
    }
}
