package com.toxinhub.roster;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends Activity {
    private static final String URL = "https://toxinhub.github.io/roster/index.html";
    private static final String CHANNEL_ID = "duty_updates";
    private static final int NOTIFICATION_REQUEST = 7001;
    private final Handler handler = new Handler();
    private WebView webView;
    private SwipeRefreshLayout refreshLayout;
    private String lastNotice = "";

    private final Runnable rosterWatcher = new Runnable() {
        @Override public void run() {
            if (webView != null) {
                webView.evaluateJavascript(
                    "(function(){return document.body?document.body.innerText:'';})()",
                    value -> {
                        if (value == null) return;
                        String text = value.replace("\\n", " ").replace("\\\"", "\"");
                        String key = extractStatus(text);
                        if (!key.isEmpty() && !key.equals(lastNotice)) {
                            lastNotice = key;
                            notifyUser("রোস্টার আপডেট", key);
                        }
                    });
            }
            handler.postDelayed(this, 60000);
        }
    };

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        createNotificationChannel();

        refreshLayout = new SwipeRefreshLayout(this);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(16,24,40));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadsImagesAutomatically(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidRoster");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return navigate(r.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, String u) {
                return navigate(Uri.parse(u));
            }
        });

        // Android 15+ is edge-to-edge by default. Keep critical web content below
        // the status/navigation bars so the roster header is never hidden.
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            int top = insets.getInsets(WindowInsetsCompat.Type.statusBars()
                    | WindowInsetsCompat.Type.displayCutout()).top;
            int bottom = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            v.setPadding(v.getPaddingLeft(), top, v.getPaddingRight(), bottom);
            return insets;
        });

        refreshLayout.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        refreshLayout.setOnRefreshListener(() -> webView.reload());
        refreshLayout.addView(webView, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(refreshLayout);
        if (state == null) webView.loadUrl(URL); else webView.restoreState(state);
        RosterWorker.schedule(this);
        requestNotificationPermission();
        handler.postDelayed(rosterWatcher, 15000);
    }

    private String extractStatus(String body) {
        String lower = body.toLowerCase();
        int i = lower.indexOf("upcoming");
        if (i >= 0) {
            int end = Math.min(body.length(), i + 100);
            return body.substring(i, end).replaceAll("\\s+", " ").trim();
        }
        return "";
    }

    private boolean navigate(Uri uri) {
        if ("toxinhub.github.io".equalsIgnoreCase(uri.getHost())) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
        return true;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel c = new NotificationChannel(
                CHANNEL_ID, getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT);
            c.setDescription(getString(R.string.notification_channel_description));
            getSystemService(NotificationManager.class).createNotificationChannel(c);
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                NOTIFICATION_REQUEST);
        }
    }

    private void notifyUser(String title, String message) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) return;

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(com.toxinhub.roster.R.drawable.ic_launcher)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true);
        getSystemService(NotificationManager.class).notify(1001, b.build());
    }

    public class AndroidBridge {
        @JavascriptInterface public void notifyRoster(String title, String message) {
            runOnUiThread(() -> notifyUser(title, message));
        }
    }

    @Override protected void onSaveInstanceState(Bundle out) {
        webView.saveState(out); super.onSaveInstanceState(out);
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (webView != null) { webView.stopLoading(); webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
